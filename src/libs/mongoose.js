import mongoose from "mongoose";
import config from "../config/env.config.js";
import logger from "./logger.js";

export const connectDB = async () => {
  try {
    const db = await mongoose.connect(config.MONGO_URI);
    logger.info(`DB conectada a: ${db.connection.name}`);
  } catch (error) {
    logger.error("Error conectando a MongoDB:", error);
    process.exit(1); // Detiene la app si no hay DB
  }
};

export const disconnectDB = () => mongoose.disconnect();
