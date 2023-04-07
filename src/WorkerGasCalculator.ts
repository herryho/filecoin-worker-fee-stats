const path = require("path");
const fs = require("fs");
const axios = require("axios");
const CryptoJS = require("crypto-js");
require("dotenv").config();

export default class WorkerGasCalculator {
  constructor() {
    this.requester = axios.create({
      method: "POST",
      json: true,
      headers: { "Content-Type": "application/json" },
    });
  }
  requester;

  async getWorkerGasByPage(worker: string, page: number, size: number = 100) {
    const url = `https://filfox.info/api/v1/address/${worker}/transfers?pageSize=${size}&page=${page}`;
    const messageInfo = await this.requester.get(url);
    console.log(
      `messageInfo: ${JSON.stringify(messageInfo.data.transfers.length)}`
    );

    return messageInfo.data.transfers;
  }

  async getWorkerAllGasByPage(
    worker: string,
    fromBlock: number,
    toBlock: number
  ) {
    let page = 0;
    let stopFlag = false;

    while (!stopFlag) {
      let data = await this.getWorkerGasByPage(worker, page);
      let toInsertList = [];
      if (data && data.length) {
        for (const datum of data) {
          // 如果在区间，就存下来
          if (datum.height >= fromBlock && datum.height < toBlock) {
            const message_info = `${datum.message}${datum.to}${datum.type}`;
            const message_hash = CryptoJS.MD5(message_info).toString();

            let newItem = {
              message_hash,
              block_height: datum.height,
              message_cid: datum.message,
              timestamp: datum.timestamp,
              from: datum.from,
              to: datum.to,
              value: datum.value,
              type: datum.type,
            };

            toInsertList.push(newItem);
            //如果比toBlock大，就继续往下走
          } else if (datum.height >= toBlock) {
            continue;
            //如果比fromBlock小，就停下来
          } else {
            stopFlag = true;
            break;
          }
        }

        //!TO-do 这里需要写入数据库，一页一页地存，不然怕一次性数据量太大
        if (toInsertList.length) {
          await this.saveToCSV(toInsertList);
        }

        // 等待5秒，再去获取
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      page = page + 1;
    }
  }

  async getAllWorkerGasByPage(
    workers: string[],
    fromBlock: number,
    toBlock: number
  ) {
    await Promise.all(
      workers.map(async (worker) => {
        await this.getWorkerAllGasByPage(worker, fromBlock, toBlock);
      })
    );
  }

  // 保存数据到CSV文件
  async saveToCSV(dataArray: any) {
    const filePath = path.join(__dirname, "data.csv");
    let rows = "";
    dataArray.forEach((data: any) => {
      rows += `${data.message_hash},${data.block_height},${data.message_cid},${data.timestamp},${data.from},${data.to},${data.value},${data.type}\n`;
    });
    fs.appendFile(filePath, rows, (err: any) => {
      if (err) {
        console.error(`Failed to save data to CSV: ${err}`);
      } else {
        console.log(`Data saved to ${filePath}`);
      }
    });
  }
}
