import {
  establishConnection,
  establishPayer,
  checkProgram,
  acceptBid,
} from './test';

async function main() {
  console.log("Updating value stored in a Solana account...");

  // Establish connection to the cluster
  await establishConnection();

  // Determine who pays for the fees
  await establishPayer();

  // Check if the program has been deployed
  await checkProgram();

  // Update value stored in account
  await acceptBid();

  console.log('Success');
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);