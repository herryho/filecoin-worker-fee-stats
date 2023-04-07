import WorkerGasCalculator from "./WorkerGasCalculator";

// 导入dotenv模块,获取环境变量
require("dotenv").config();

const main = async () => {
  let gasCalculator = new WorkerGasCalculator();

  let worker = [
    "f3q4twolpyaxozwbkp44nmqgswenu4jpgu2w3ff5twyhkx2x4uhnnt7b3luos3sjmnpogywqyct55jmfkgnuta",
  ];
  let data = gasCalculator.getAllWorkerGasByPage(worker, 2752485, 2752486);

  console.log(`${JSON.stringify(data)}`);
};

main();
