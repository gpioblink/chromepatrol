import json
import uuid
from ast import literal_eval

from flask import current_app as app

from detectors import DetectionMode
from detectors import DetectionTarget
from detectors import DetectorBase
from detectors import ReleaseStage
from detectors import Severity


class Detector(DetectorBase):

    NAME = "Chromepatrol"
    VERSION = "latest"
    SUPPORTED_MODE = [DetectionMode.SAFE.value]
    TARGET_TYPE = DetectionTarget.URL.value
    STAGE = ReleaseStage.ALPHA.value
    DESCRIPTION = "Web server scanner"

    POD_NAME_PREFIX = "ncpatrol"
    POD_NAMESPACE = "default"
    POD_RESOURCE_REQUEST = {"memory": "512Mi", "cpu": "0.5"}
    POD_RESOURCE_LIMIT = {"memory": "1Gi", "cpu": "1"}

    CONTAINER_IMAGE = "gpioblink/chromepatrol:v1.0"

    CMD_RUN_SCAN = (
        "touch /tmp/result.json && node index.js {target} /tmp/result.json  > /dev/null 2> /tmp/error.txt"
    )
    CMD_CHECK_SCAN_STATUS = "ps x | grep 'node index.js' | grep -v grep | wc -c"
    CMD_GET_SCAN_RESULTS = "cat /tmp/result.json"
    CMD_GET_ERROR_REASON = "cat /tmp/error.txt"

    def __init__(self, session):
        super().__init__(session)

    def create(self):
        app.logger.info("Try to create detector: session={}".format(self.session))

        pod_name = self.POD_NAME_PREFIX + "-" + uuid.uuid4().hex
        resp = None
        pod_manifest = {
            "apiVersion": "v1",
            "kind": "Pod",
            "metadata": {"name": pod_name},
            "spec": {
                "restartPolicy": "Never",
                "containers": [
                    {
                        "image": self.CONTAINER_IMAGE,
                        "image_pull_policy": "IfNotPresent",
                        "name": self.POD_NAME_PREFIX,
                        "command": ["chromium", "--headless", "--disable-gpu", "--no-sandbox", "--remote-debugging-address=0.0.0.0", "--remote-debugging-port=9222"],
                        "resources": {
                            "requests": self.POD_RESOURCE_REQUEST,
                            "limits": self.POD_RESOURCE_LIMIT,
                        },
                    }
                ],
            },
        }
        resp = self.core_api.create_namespaced_pod(body=pod_manifest, namespace=self.POD_NAMESPACE)
        app.logger.info("Created detector successfully: resp={}".format(resp))
        self.session = {"pod": {"name": pod_name}}
        return self.session

    def delete(self):
        return super().delete()

    def run(self, target, mode):
        return super().run(target, mode)

    def is_ready(self):
        return super().is_ready()

    def is_running(self):
        return super().is_running()

    def get_results(self):
        results, report = super().get_results()
        if len(report) > 0:
            report = literal_eval(report)
            for vulnerability in report["vulnerabilities"]:
                results.append(vulnerability)
        else:
            resp = self._pod_exec(self.CMD_GET_ERROR_REASON)
            raise Exception(resp)

        return results, json.dumps(report)