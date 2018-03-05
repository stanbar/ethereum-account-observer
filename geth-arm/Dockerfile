FROM ubuntu:latest

# Insatll wget
RUN	apt-get update \
	&& apt-get install -y wget \
	&& rm -rf /var/lib/apt/lists/*

#Donwload geth and copy into /usr/local/bin
RUN	 mkdir gethDownload \
	&& wget -qO- https://gethstore.blob.core.windows.net/builds/geth-linux-arm7-1.8.1-1e67410e.tar.gz \
	| tar xvz -C gethDownload --strip-components 1 \
	&& cd gethDownload \
	&& mkdir -p /usr/local/bin \
	&& mv geth /usr/local/bin/ \
	&& cd .. \
	&& rm -r gethDownload

EXPOSE 8545 8546 30303 30303/udp 30304/udp

ENTRYPOINT ["geth"]