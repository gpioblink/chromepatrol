const CDP = require('chrome-remote-interface');
const { Certificate } = require('@fidm/x509');
const fs = require("fs");

async function runner() {
    let client;
    const url = process.argv[2];
    const jsonFile = process.argv[3];
    const result = [];

    console.log(`INSPECT: ${url}`);
    try {
        client = await connect();
        await setEventListeners(client, result);
        await enableEventListeners(client);
        await manipurateBrowser(client, url);
        await reportJSON(result, url, jsonFile);
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

async function connect() {
    return await CDP({
        port: 9222,
        host: "localhost"
      });
}

async function manipurateBrowser(client, url) {
    const {Network, Page, Runtime, DOM, CSS, 
        Debugger, Overlay, Profiler, Log, Audits, 
        ServiceWorker, Inspector, HeapProfiler, Security} = client;
    const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

    // enable events then start!
    await Page.navigate({url: url});
    await Page.loadEventFired();
}

async function setEventListeners(client, result) {
    const {Network, Page, Runtime, DOM, CSS, 
        Debugger, Overlay, Profiler, Log, Audits, 
        ServiceWorker, Inspector, HeapProfiler, Security} = client;
    
    /* DevToolsから見れるセキュリティのエラー */

    // Chromeが見つけたセキュリティのエラーを通知
    Audits.issueAdded((params) => {
        const report = {title: `Audit - ${params.issue.code}`, description: "", advise: ""};
        switch(params.issue.code) {
            case "SameSiteCookieIssue":
                const samesite = params.issue.details.sameSiteCookieIssueDetails;
                const cookie = samesite.cookie;
                const operation = samesite.operation;
                const warnings = samesite.cookieWarningReasons;
                const exclusions = samesite.cookieExclusionReasons;
                const siteForCookies = samesite.siteForCookies;
                const cookieUrl = samesite.cookieUrl;
                report.description = `${operation} [${cookie.name}　(${cookie.path})] from ${cookie.domain} has some issue. ${(warnings.length)? `Warning: ${warnings}` : ""} ${(exclusions.length)? `Exclusion: ${exclusions.length},` : ""}`;
                report.advise = `Please check the request to ${cookieUrl}`;
                break;
            case "MixedContentIssue":
                const mixedcontent = params.issue.details.mixedContentIssueDetails;
                const resourceType = mixedcontent.resourceType;
                const status = mixedcontent.resolutionStatus;
                const insecureURL = mixedcontent.insecureURL;
                const mainResourceURL = mixedcontent.mainResourceURL;
                report.description = `${status}. ${(resourceType)? `Type: ${resourceType}` : ""}`;
                report.advise = `The main url ${mainResourceURL} calls the insecure url ${insecureURL}. Please remove this insecure call.`;
                break;
            case "BlockedByResponseIssue":
                const blockedbyresponse = params.issue.blockedByResponseIssueDetails;
                const reason = blockedbyresponse.reason;
                const request = blockedbyresponse.request;
                report.description = `${reason}. ${request.url}`;
                report.advise = `Please review your server settings.`;
                break;
            case "HeavyAdIssue":
                const heavyadissue = params.issue.HeavyAdIssueDetails;
                const resolution = heavyadissue.resolution;
                const heavyReason = heavyadissue.reason;
                const frameId = heavyadissue.frameId;
                report.description = `${resolution}. Due to ${heavyReason}`;
                report.advise = `Investigate the content of the frame ID ${frameId}`;
                break;
            case "ContentSecurityPolicyIssue":
                const contentsecuritypolicy = params.issue.contentSecurityPolicyIssueDetails;
                const blockedURL = contentsecuritypolicy.blockedURL;
                const violatedDirective = contentsecuritypolicy.violatedDirective;
                const violationType = contentsecuritypolicy.contentSecurityPolicyViolationType;
                report.description = `${violationType}. Directive: ${violatedDirective}`;
                report.advise = `Check the blockedURL ${blockedURL}`;
                break;
        }
        result.push(report);
        console.log(report.title);
    });

    // console.logで出てきているwarningやissueを取得
    Log.entryAdded((params) => {
        const report = {title: `Log - ${params.entry.level}`, description: "", advise: ""};
        if(params.entry.level === "warning" || params.entry.level === "error") {
            const text = params.entry.text;
            const source = params.entry.source;
            const url = params.entry.url;
            const lineNumber = params.entry.lineNumber;
            report.description = text;
            report.advise = `This log was added by ${source}. ${url} ${(lineNumber)? ` Line:${lineNumber}` : ""}`;
            result.push(report);
            console.log(report.title);
        }
    });

    // 現在の暗号化情報を通知
    Security.securityStateChanged((params) => {
        if(params.securityState == "insecure" || params.securityState == "insecure-broken") {
            const report = {title: `Security - ${params.securityState}`, description: "", advise: ""};
            params.explanations.forEach(element => {
                report.description += `[${element.summary}] ${element.description}\n`;
            });
            result.push(report);
            console.log(report.title);
        }
    });

    // 送信されなかったCookieについての詳細情報を取得
    Network.requestWillBeSentExtraInfo((params) => {
        if(params.associatedCookies?.length) {
            const report = {title: `Network - BlockedGetCookie`, description: "", advise: ""};
            const requestHeaders = JSON.stringify(params.headers);
            params.associatedCookies.forEach(element => {
                const cookieName = element.cookie.name;
                const cookieValue = element.cookie.value;
                const cookieDomain = element.cookie.domain;
                const cookiePath = element.cookie.path;
                const cookieReason = element.blockedReasons;
                report.description += `The cookie [${cookieName}=${cookieValue} (${cookieDomain} ${cookiePath})] was blocked${(cookieReason.length)? ` due to ${cookieReason}` : ""}\n`;
            });
            // report.advise = `Request header: ${requestHeaders}`;
            result.push(report);
            console.log(report.title);
        }
    });

    // 受信されなかったCookieについての詳細情報を取得
    Network.responseReceivedExtraInfo((params) => {
        if(params.blockedCookies?.length) {
            const report = {title: `Network - BlockedSetCookie`, description: "", advise: ""};
            const requestHeaders = JSON.stringify(params.headers);
            params.blockedCookies.forEach(element => {
                const cookieName = element.cookie.name;
                const cookieValue = element.cookie.value;
                const cookieDomain = element.cookie.domain;
                const cookiePath = element.cookie.path;
                const cookieReason = element.blockedReasons;
                report.description += `The cookie [${cookieName}=${cookieValue} (${cookieDomain} ${cookiePath})] was blocked${(cookieReason.length)? ` due to ${cookieReason}` : ""}\n`;
            });
            // report.advise = `Response header: ${requestHeaders}`;
            result.push(report);
            console.log(report.title);
        }
    });

    /* 証明書検知ルール */

    // 証明書失効 N日前検知ルール (N = 30)
    const EXPIRE_N = 30;
    Security.securityStateChanged((params) => {
        const report = {title: `Custom - CertificateAlmostExpired`, description: "", advise: ""};
        let problemFlag = false;
        params.explanations.forEach(element => {
            element.certificate.forEach(cert => {
                const certDate = getCertificateExpirationDate(cert);
                if(certDate < getDateNDaysBeforeFromToday(EXPIRE_N)) {
                    problemFlag = true;
                    report.description += `A certificate for this site will be expired at ${certDate}\n`;
                }
            });
        });
        if(problemFlag) {
            result.push(report);
            console.log(report.title);
        }
    });

    // 任意の認証機関を検知するルール (S = Let's Encrypt)
    const BAD_SSL_AUTHORITIE = "Let's Encrypt";
    Security.securityStateChanged((params) => {
        const report = {title: `Custom - BadSSLAuthoritie`, description: "", advise: ""};
        let problemFlag = false;
        params.explanations.forEach(element => {
            element.certificate.forEach(cert => {
                const certName = getCertificateCommonName(cert);
                if(certName.indexOf(BAD_SSL_AUTHORITIE) != -1) {
                    problemFlag = true;
                    report.description += `A certificate has bad authoritie. ${certName}\n`;
                }
            });
        });
        if(problemFlag) {
            report.advise = "Let's Encrypt causes many problem. Please consider to use other certificate.";
            result.push(report);
            console.log(report.title);
        }
    });

    // TLS 1.1 使ってるか

}

function getDateNDaysBeforeFromToday(n) {
    const date = new Date();
    date.setDate(date.getDate() - n);
    return date;
}

function getCertificateExpirationDate(rawcert) {
    const x509cert = `-----BEGIN CERTIFICATE-----\n${rawcert.replace(/(.{64})/g, "$1\n")}\n-----END CERTIFICATE-----`; // X.509のフォーマットに変換
    const issuer = Certificate.fromPEM(x509cert);
    return issuer.validTo;
}

function getCertificateCommonName(rawcert) {
    const x509cert = `-----BEGIN CERTIFICATE-----\n${rawcert.replace(/(.{64})/g, "$1\n")}\n-----END CERTIFICATE-----`; // X.509のフォーマットに変換
    const issuer = Certificate.fromPEM(x509cert);
    return issuer.issuer.commonName;
}

async function enableEventListeners(client) {
    const {Network, Page, Runtime, DOM, CSS, 
        Debugger, Overlay, Profiler, Log, Audits, 
        ServiceWorker, Inspector, HeapProfiler, Security} = client;
    
    // enableできるやつは全てenable
    await Network.enable();
    await Page.enable();
    await Runtime.enable();
    await DOM.enable();
    await CSS.enable();
    await Debugger.enable();
    await Overlay.enable();
    await Profiler.enable();
    await Log.enable();
    await Audits.enable();
    await ServiceWorker.enable();
    await Inspector.enable();
    await HeapProfiler.enable();
    await Security.enable();
}

async function reportJSON(result,url, jsonFile) {
    const urlInfo = new URL(url);
    const host = urlInfo.hostname;
    const port = urlInfo.port;

    const ntdresult = result.map(problem => {
        return {
            host: host,
            port: port,
            description: `${problem.description}\n${problem.advise}`,
            name: problem.title,
            severity: "Info"
        }
    });
    console.log(ntdresult);

    if(jsonFile) {
        const ntdFormat = {"vulnerabilities": ntdresult};
        fs.writeFileSync(jsonFile, JSON.stringify(ntdFormat));
        console.log(`result was written at ${jsonFile}`);
    }
}
 
runner();