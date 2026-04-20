import packageJson from "@/package.json"

const deploymentId = process.env.VERCEL_DEPLOYMENT_ID?.replace(/^dpl_/, "")

export const appVersion = deploymentId
  ? `${packageJson.version}+${deploymentId.slice(0, 8)}`
  : packageJson.version
