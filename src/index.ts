import "dotenv/config";
import Logger from './utils/logger';
import { port } from './config';
import app from './app';
import { config } from 'dotenv';

config({ path: '../.env' });

app
  .listen(port, () => {
    Logger.info(`server running on port : ${port}`);
  })
  .on('error', (e: Error) => Logger.error(e));
