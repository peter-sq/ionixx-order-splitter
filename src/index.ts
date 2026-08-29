import { createApp } from './app';
import { config } from './config';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Ionixx Order Splitter API listening on port ${config.port} (${config.env})`);
  console.log(`Swagger docs available at http://localhost:${config.port}/docs`);
});
