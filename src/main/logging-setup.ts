import { logger } from "./logger";

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", err);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Rejection", reason);
});

process.on("exit", (code) => {
  logger.info(`Process exit code=${code}`);
});
