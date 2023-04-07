const ExcelJS = require("exceljs");
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
          await this.writeNewData(toInsertList);
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

  async writeNewData(newData: any) {
    // 读取Excel文件
    const filePath = path.join(__dirname, "data.xlsx");
    const workbook = new ExcelJS.Workbook();
    if (fs.existsSync(filePath)) {
      workbook.xlsx
        .readFile(filePath)
        .then(() => {
          // 获取第一个工作表
          const worksheet = workbook.getWorksheet(1);

          // 逐行添加数据
          newData.forEach((data: any) => {
            const newRow = worksheet.addRow(data);
            newRow.commit();
          });

          console.log(`worksheet: ${JSON.stringify(worksheet._rows[0])}`);

          // 保存Excel文件
          return workbook.xlsx.writeFile(filePath);
        })
        .then(() => {
          console.log("Data added to Excel file.");
        })
        .catch((error: any) => {
          console.log(error);
        });
    } else {
      // 如果文件不存在，创建一个新的Excel文件并添加数据
      const worksheet = workbook.addWorksheet("Sheet1");
      worksheet.addRow([
        "message_hash",
        "block_height",
        "message_cid",
        "timestamp",
        "from",
        "to",
        "value",
        "type",
      ]);
      newData.forEach((data: any) => {
        worksheet.addRow(data);
      });

      console.log(`worksheet: ${JSON.stringify(worksheet)}`);
      workbook.xlsx
        .writeFile(filePath)
        .then(() => {
          console.log("Data added to Excel file.");
        })
        .catch((error: any) => {
          console.log(error);
        });
    }
  }
}
