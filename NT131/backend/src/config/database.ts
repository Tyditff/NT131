import dns from "node:dns";
import mongoose from "mongoose";

const DEFAULT_MONGODB_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];

const getMongoUri = () => {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  return uri;
};

const getMongoDnsServers = () => {
  const configuredServers = process.env.MONGODB_DNS_SERVERS?.split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  return configuredServers?.length
    ? configuredServers
    : DEFAULT_MONGODB_DNS_SERVERS;
};

const connectMongo = async (uri: string) => {
  return mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });
};

const shouldRetryWithCustomDns = (
  uri: string,
  error: unknown,
): error is NodeJS.ErrnoException => {
  if (!uri.startsWith("mongodb+srv://")) {
    return false;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as NodeJS.ErrnoException).code;
  const syscall = (error as NodeJS.ErrnoException).syscall;

  return (
    (syscall === "querySrv" || syscall === "queryTxt") &&
    (code === "ECONNREFUSED" || code === "ETIMEOUT" || code === "ENOTFOUND")
  );
};

async function checkConnection() {
  const uri = getMongoUri();

  try {
    const conn = await connectMongo(uri);
    console.log("MongoDB connected successfully");
    return conn;
  } catch (error) {
    if (shouldRetryWithCustomDns(uri, error)) {
      const dnsServers = getMongoDnsServers();

      console.warn(
        `MongoDB SRV lookup failed with system DNS. Retrying with ${dnsServers.join(", ")}`,
      );

      dns.setServers(dnsServers);
      await mongoose.disconnect().catch(() => undefined);

      try {
        const conn = await connectMongo(uri);
        console.log("MongoDB connected successfully");
        return conn;
      } catch (retryError) {
        console.error("MongoDB connection failed after DNS retry:", retryError);
        throw retryError;
      }
    }

    console.error("MongoDB connection failed:", error);
    throw error;
  }
}

export default checkConnection;
