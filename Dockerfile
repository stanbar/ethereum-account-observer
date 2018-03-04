FROM node:latest

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY ./src ./src

# Wait for geth to open WebSocket connection
COPY ./wait-for-it.sh ./
RUN chmod +x wait-for-it.sh

EXPOSE 8546

CMD [ "./wait-for-it.sh" ,"geth:8546", "-t", "3", "--" ,"npm", "start" ]

