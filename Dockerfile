FROM archlinux:latest

RUN pacman -Syy udev ttf-freefont noto-fonts noto-fonts-cjk chromium npm --noconfirm

WORKDIR /home/chrome
ADD chromepatrol .
RUN npm install

# run chrome as non-privilaged
RUN useradd chrome
RUN chown -R 1000:1000 "/home/chrome/"
USER chrome

ENTRYPOINT ["chromium", "--headless", "--disable-gpu", "--no-sandbox", "--remote-debugging-address=0.0.0.0", "--remote-debugging-port=9222"]
