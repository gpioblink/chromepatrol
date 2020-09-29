# ChromeDevToolsProtocolから取れる情報のまとめ

ChromeDevToolsProtocolから取れる、検証に便利なメソッドやイベントをまとめました。

中でも重要そうなメソッドやイベントは下の基準で:star:をつけています。

- :star:️:star:️ Chrome側が教えてくれるリスク情報が含まれているメソッド・イベント
- :star:️ リスク検出に便利そうなメソッド・イベント

## 汎用の通知

### イベント Debugger.scriptParsed

スクリプトが解析された時に発火。
JavaScriptのファイルに限らず、DOM上から実行されたり、コンソールから実行されたりするコマンドも対象。スクリプトが解析されたらいつでも発火。

### イベント Runtime.executionContextCreated

サイト本体やiframeなど実行コンテキストが作成されるごとに発火。(他にも作成されるタイミングがあるかも)

### イベント Target.targetCreated

ターゲットが作成された時に発火。つまり、ページ遷移が発生した場合に発火する。ページ遷移などでURLやタイトルが変わった場合は`Target.targetInfoChanged`が実行される。SPAの場合でもURLやタイトルが変われば発火。

## Consoleタブ 周り

### :star:️ イベント Runtime.consoleAPICalled

コンソールに表示する文字列が来た時に発火。文字列はもちろん、log, debugといった表示の種類や、timestamp、表示までのstackTraceも返してくれる。

### メソッド Runtime.evaluate

ChromeのDevツール上でコマンドを実行すると投げられて結果が戻ってくる

## Issuesタブ 周り

### :star:️:star:️ イベント Audits.issueAdded (EXPERIMENTAL)

SameSiteCookieIssue, MixedContentIssue, BlockedByResponseIssue, HeavyAdIssue, ContentSecurityPolicyIssueを検出したらイベントを返す。

## Networkタブ 周り

### イベント Network.dataReceived 

ネットワークからデータを受け取ったら発火。タイムスタンプ、データの大きさのみ。

### :star:️:star:️ イベント Network.requestWillBeSentExtraInfo (EXPERIMENTAL)

requestWillBeSentに関する詳細情報。requsetWillBeSentにもあるヘッダの情報に加えて、「送信されなかったCookieとその理由(secureOnly, NotOnPath, DomainMismatch, SameSiteStrict, SameSiteLax, SameSiteUnspecifiedTreatedAsLax, SameSiteNoneInsecure, UserPreferences, UnknownError)」が入手できる。

### :star:️ イベント Network.requestWillBeSent

HTTPリクエストが送信されようとする時に発火。このリクエストがどのスクリプトのどの行によるものなのかや、リクエストヘッダが分かる。CORSの安全性とか調べるのに使えるかも。

### :star:️ イベント Network.responseReceived

レスポンスが返ってきた時に発火。cipherなど鍵交換に関する情報もあり。レスポンスヘッダに加え、リクエストが始まったタイミングや終了のタイミングも詳細に取れる。取れた本文が欲しい場合は、メソッド`Network.getResponseBody`で別に要求する必要あり。

### :star:️:star:️イベント Network.responseReceivedExtraInfo(EXPERIMENTAL)

requsetWillBeSentExtraInfoと同様に、ヘッダと送信されなかったCookie, その理由が返ってくる

### :star:️ Network.loadingFailed  

HTTPリクエストが失敗した時に発火。失敗理由のstring付き。

### Network.loadingFinished

HTTPリクエストが完了した際に発火。タイムスタンプのみ。

## Securityタブ周り

### :star::star: Security.securityStateChanged

securityStateとして、unknown, neutral, insecure, secure, info, insecure-brokenのいずれかを返してくれる。
また、explanations.{title,summary,description}にそれぞれstringで`Certificate`、`valid and trusted`、`The connection to this site is using a valid, trusted server certificate issued by DigiCert SHA2 Secure Server CA.`のようなデータが入っている

## Performanceタブ周り

Performance系のメソッドやイベントは使わず、スクリーンショットを定期的にとったり、Networkを監視しているだけっぽい？ドキュメントを見ると、一応、`Performance.metrics`というのがあるが、metricの名前と数字だけ返すものらしく詳細は要調査。

## Memoryタブ周り

### HeapProfiler.addHeapSnapshotChunk (EXPERIMENTAL)

100KB超えの巨大stringで、メモリの内容が帰ってくる。詳細は要調査。

## Application 周り

### :star: メソッド `Network.getCookies`

パラメータとして要求したURLに対するCookieを返す。

### :star: Storage.cacheStorageContentUpdated Storage.cacheStorageListUpdated Storage.indexedDBContentUpdated Storage.indexedDBListUpdated (EXPERIMENTAL)

indexedDBやLocalStorageの内容が変化した時に呼ばれる

## LightHouse周り

LightHouse専用のAPIは特になさそうで、今まで出てきたものも含め、自動でいろんなAPIを叩いて調査してくれる。