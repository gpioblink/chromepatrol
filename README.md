# chromepatrol

Headless Chrome 経由で、サイト上のリスクを検出するツールです。

# 使い方

1. プロジェクトのルートで`docker build -t gpioblink/chromepatrol .`を実行しビルド
1. `docker run --name hogehoge -it gpioblink/chromepatrol`でコンテナを立ち上げる
1. `docker exec -it hogehoge node index.js https://<検証したいURL>`でリスク検出を実行
1. `docker stop hogehoge`と`docker rm hogehoge`を実行して終了

# NT-Dとの統合について

## minikubeで立ち上げる場合

1. [NT-DのREADME](https://github.com/nishimunea/NT-D/blob/master/README.md)を参考にNT-Dが起動できるようにします
1. `eval $(minikube docker-env)`と`docker build -t gpioblink/chromepatrol:v1.0 .`を実行してminikube内にイメージをビルドします
1. このプロジェクトの`for-ntd/chromepatrol_latest.py`をNT-Dの`core/detectors`にコピーします
1. NT-DのUI上から`chromepatrol_latest`を用いて検証を試してみてください

# Tips

## ChromeDevToolsProtocolから取れる情報について

重要なイベントやメソッドを`docs/useful-cdp-functions.md`にまとめていますので参考にしてください。

## ChromeのDevToolsをDevToolsで開く方法

この方法を使用すると、Chromeが開発者ツール上から叩いている情報を知ることができます。Chromeが使用しているメソッドやイベントを参考にしながらルール作成の参考にできます。

1. `alias chrome="/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome"`
1. `chrome --headless --disable-gpu --remote-debugging-port=9222 https://example.com`
1. 別のchromeから http://localhost:9222 にアクセス
1. 開きたいタブを選択するとデバッグ画面が出る
1. さらにショートカットキーで開発者ツールをを開く
1. 5で開いた開発者ツールのネットワークから、websocketの通信を覗くと、CDPでやってることが分かる