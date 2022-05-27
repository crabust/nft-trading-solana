/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import {
  Account,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionInstruction,
  Transaction,
  sendAndConfirmTransaction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID} from "@solana/spl-token";
import fs from 'mz/fs';
import path from 'path';
import * as borsh from 'borsh';

import {
  getPayer,
  getRpcUrl,
  longToByteArray,
  newAccountWithLamports,
  readAccountFromFile,
  findAssociatedTokenAddress
} from './utils';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Account (keypair)
 */
let payerAccount: Account;

/**
 *  Test program id
 */
let programId: PublicKey;

/**
 * Path to program files
 */
const PROGRAM_PATH = path.resolve(__dirname, '../../dist/program');

/**
 * Path to program shared object file which should be deployed on chain.
 * This file is created when running either:
 *   - `npm run build:program-c`
 *   - `npm run build:program-rust`
 */
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'test.so');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/test.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'test-keypair.json');

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();
  connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
}

/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {
  let fees = 0;
  if (!payerAccount) {
    const {feeCalculator} = await connection.getRecentBlockhash();

    // Calculate the cost to fund the greeter account
    fees += await connection.getMinimumBalanceForRentExemption(49);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag

    try {
      // Get payer from cli config
      payerAccount = await getPayer();
    } catch (err) {
      // Fund a new payer via airdrop
      payerAccount = await newAccountWithLamports(connection, fees);
    }
  }

  const lamports = await connection.getBalance(payerAccount.publicKey);
  if (lamports < fees) {
    // This should only happen when using cli config keypair
    const sig = await connection.requestAirdrop(
      payerAccount.publicKey,
      fees - lamports,
    );
    await connection.confirmTransaction(sig);
  }

  console.log(
    'Using account',
    payerAccount.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'SOL to pay for fees',
  );
}

/**
 * Check if the Test BPF program has been deployed
 */
export async function checkProgram(): Promise<void> {
  // Read program id from keypair file
  try {
    const programAccount = await readAccountFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programAccount.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy dist/program/test.so\``,
    );
  }

  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        'Program needs to be deployed with `solana program deploy dist/program/test.so`',
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }
  console.log(`Using program ${programId.toBase58()}`);
}

/**
 * Update value stored in account
 */
export async function initializeProgram(): Promise<void> {
  const byteArray = [0];
  const instrunctionBuffer = Buffer.from(byteArray);
  const authorityBuffer = Buffer.from(payerAccount.publicKey.toBytes());
  const feeBytes = longToByteArray(10000000);
  const feeBuffer = Buffer.from(feeBytes)
  const list = [instrunctionBuffer, authorityBuffer, feeBuffer];
  const buffer = Buffer.concat(list);

  const accountPubKey = await PublicKey.findProgramAddress([Buffer.from("Platform"), Buffer.from("State")], programId);
  const systemPubKey = SystemProgram.programId;
  const instruction = new TransactionInstruction({
    keys: [
      {pubkey: payerAccount.publicKey, isSigner: true, isWritable: false},
      {pubkey: accountPubKey[0], isSigner: false, isWritable: true},
      {pubkey: programId, isSigner: false, isWritable: false},
      {pubkey: systemPubKey, isSigner: false, isWritable: false},
      {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false}
    ],
    programId,
    data: buffer,
  });
  console.log('Sending transaction for update')
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payerAccount],
  );
}

export async function changeAuthority(): Promise<void> {
  const byteArray = [1];
  const instrunctionBuffer = Buffer.from(byteArray);
  const authorityBuffer = Buffer.from(payerAccount.publicKey.toBytes());
  const list = [instrunctionBuffer, authorityBuffer];
  const buffer = Buffer.concat(list);

  const accountPubKey = await PublicKey.findProgramAddress([Buffer.from("Platform"), Buffer.from("State")], programId);
  const systemPubKey = SystemProgram.programId;
  const instruction = new TransactionInstruction({
    keys: [
      {pubkey: payerAccount.publicKey, isSigner: true, isWritable: false},
      {pubkey: accountPubKey[0], isSigner: false, isWritable: true}
    ],
    programId,
    data: buffer,
  });
  console.log('Sending transaction for update')
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payerAccount],
  );
}

export async function list(): Promise<void> {

  const byteArray = [3];
  const amount = longToByteArray(1000000000);
  const list = [Buffer.from(byteArray), Buffer.from(amount)];
  const buffer = Buffer.concat(list);

  const keyPairPath = path.resolve(__dirname, '../../dist/lister/lister-keypair.json')
  const listerAccount = await readAccountFromFile(keyPairPath)
  const listerPubKey = listerAccount.publicKey

  const tokenMintPubKey = new PublicKey('Fn386evLgVty7pBneoYF1shVWGZE8eqrA6fw9j8xLfDU');
  const tokenAccountPubKey = await findAssociatedTokenAddress(listerPubKey, tokenMintPubKey);
  const escrowStatePubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    listerPubKey.toBuffer(),
    Buffer.from("List"),
    Buffer.from("State")
  ], programId))[0];
  const escrowVaultPubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    listerPubKey.toBuffer(),
    Buffer.from("List"),
    Buffer.from("Vault")
  ], programId))[0];

  const instruction = new TransactionInstruction({
    keys: [
      {pubkey: listerPubKey, isSigner: true, isWritable: false},
      {pubkey: tokenAccountPubKey, isSigner: false, isWritable: true},
      {pubkey: tokenMintPubKey, isSigner: false, isWritable: true},
      {pubkey: escrowStatePubkey, isSigner: false, isWritable: true},
      {pubkey: escrowVaultPubkey, isSigner: false, isWritable: true},
      {pubkey: programId, isSigner: false, isWritable: false},
      {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
      {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false}
    ],
    programId,
    data: buffer,
  });
  console.log('Sending transaction for update')
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [listerAccount],
  );
}

export async function deList(): Promise<void> {

  const byteArray = [4];
  const list = [Buffer.from(byteArray)];
  const buffer = Buffer.concat(list);

  const keyPairPath = path.resolve(__dirname, '../../dist/lister/lister-keypair.json')
  const listerAccount = await readAccountFromFile(keyPairPath)
  const listerPubKey = listerAccount.publicKey

  const tokenMintPubKey = new PublicKey('Fn386evLgVty7pBneoYF1shVWGZE8eqrA6fw9j8xLfDU');
  const tokenAccountPubKey = await findAssociatedTokenAddress(listerPubKey, tokenMintPubKey);
  const escrowStatePubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    listerPubKey.toBuffer(),
    Buffer.from("List"),
    Buffer.from("State")
  ], programId))[0];
  const escrowVaultPubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    listerPubKey.toBuffer(),
    Buffer.from("List"),
    Buffer.from("Vault")
  ], programId))[0];

  const instruction = new TransactionInstruction({
    keys: [
      {pubkey: listerPubKey, isSigner: true, isWritable: false},
      {pubkey: tokenAccountPubKey, isSigner: false, isWritable: true},
      {pubkey: tokenMintPubKey, isSigner: false, isWritable: true},
      {pubkey: escrowStatePubkey, isSigner: false, isWritable: true},
      {pubkey: escrowVaultPubkey, isSigner: false, isWritable: true},
      {pubkey: programId, isSigner: false, isWritable: false},
      {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false}
    ],
    programId,
    data: buffer,
  });
  console.log('Sending transaction for update')
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [listerAccount],
  );
}

export async function bid(): Promise<void> {

  const byteArray = [5];
  const amount = longToByteArray(1000000000);
  const list = [Buffer.from(byteArray), Buffer.from(amount)];
  const buffer = Buffer.concat(list);

  const keyPairPath = path.resolve(__dirname, '../../dist/bidder/bidder-keypair.json')
  const bidderAccount = await readAccountFromFile(keyPairPath)
  const bidderPubKey = bidderAccount.publicKey

  const tokenMintPubKey = new PublicKey('Fn386evLgVty7pBneoYF1shVWGZE8eqrA6fw9j8xLfDU');
  const tokenAccountPubKey = await findAssociatedTokenAddress(bidderPubKey, tokenMintPubKey);
  const escrowStatePubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    bidderPubKey.toBuffer(),
    Buffer.from("Bid"),
    Buffer.from("State")
  ], programId))[0];
  const escrowVaultPubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    bidderPubKey.toBuffer(),
    Buffer.from("Bid"),
    Buffer.from("Vault")
  ], programId))[0];

  const instruction = new TransactionInstruction({
    keys: [
      {pubkey: bidderPubKey, isSigner: true, isWritable: false},
      {pubkey: tokenMintPubKey, isSigner: false, isWritable: true},
      {pubkey: escrowStatePubkey, isSigner: false, isWritable: true},
      {pubkey: escrowVaultPubkey, isSigner: false, isWritable: true},
      {pubkey: programId, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
      {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false}
    ],
    programId,
    data: buffer,
  });
  console.log('Sending transaction for update')
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [bidderAccount],
  );
}

export async function withdrawBid(): Promise<void> {

  const byteArray = [6];
  const list = [Buffer.from(byteArray)];
  const buffer = Buffer.concat(list);

  const keyPairPath = path.resolve(__dirname, '../../dist/bidder/bidder-keypair.json')
  const bidderAccount = await readAccountFromFile(keyPairPath)
  const bidderPubKey = bidderAccount.publicKey

  const tokenMintPubKey = new PublicKey('Fn386evLgVty7pBneoYF1shVWGZE8eqrA6fw9j8xLfDU');
  const escrowStatePubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    bidderPubKey.toBuffer(),
    Buffer.from("Bid"),
    Buffer.from("State")
  ], programId))[0];
  const escrowVaultPubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    bidderPubKey.toBuffer(),
    Buffer.from("Bid"),
    Buffer.from("Vault")
  ], programId))[0];

  const instruction = new TransactionInstruction({
    keys: [
      {pubkey: bidderPubKey, isSigner: true, isWritable: false},
      {pubkey: tokenMintPubKey, isSigner: false, isWritable: true},
      {pubkey: escrowStatePubkey, isSigner: false, isWritable: true},
      {pubkey: escrowVaultPubkey, isSigner: false, isWritable: true},
      {pubkey: programId, isSigner: false, isWritable: false}
    ],
    programId,
    data: buffer,
  });
  console.log('Sending transaction for update')
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [bidderAccount],
  );
}

export async function acceptBid(): Promise<void> {

  const byteArray = [7];
  const list = [Buffer.from(byteArray)];
  const buffer = Buffer.concat(list);

  const listerKeyPairPath = path.resolve(__dirname, '../../dist/lister/lister-keypair.json')
  const listerAccount = await readAccountFromFile(listerKeyPairPath)
  const listerPubKey = listerAccount.publicKey

  const bidderKeyPairPath = path.resolve(__dirname, '../../dist/bidder/bidder-keypair.json')
  const bidderAccount = await readAccountFromFile(bidderKeyPairPath)
  const bidderPubKey = bidderAccount.publicKey

  const tokenMintPubKey = new PublicKey('Fn386evLgVty7pBneoYF1shVWGZE8eqrA6fw9j8xLfDU');
  const listEscrowStatePubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    listerPubKey.toBuffer(),
    Buffer.from("List"),
    Buffer.from("State")
  ], programId))[0];
  const listEscrowVaultPubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    listerPubKey.toBuffer(),
    Buffer.from("List"),
    Buffer.from("Vault")
  ], programId))[0];
  const bidEscrowStatePubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    bidderPubKey.toBuffer(),
    Buffer.from("Bid"),
    Buffer.from("State")
  ], programId))[0];
  const bidEscrowVaultPubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    bidderPubKey.toBuffer(),
    Buffer.from("Bid"),
    Buffer.from("Vault")
  ], programId))[0];

  const instruction = new TransactionInstruction({
    keys: [
      {pubkey: listerPubKey, isSigner: true, isWritable: false},
      {pubkey: tokenMintPubKey, isSigner: false, isWritable: true},
      {pubkey: bidderPubKey, isSigner: false, isWritable: true},
      {pubkey: bidEscrowStatePubkey, isSigner: false, isWritable: true},
      {pubkey: bidEscrowVaultPubkey, isSigner: false, isWritable: true},
      {pubkey: listEscrowStatePubkey, isSigner: false, isWritable: true},
      {pubkey: listEscrowVaultPubkey, isSigner: false, isWritable: true}
    ],
    programId,
    data: buffer,
  });
  console.log('Sending transaction for update')
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [listerAccount],
  );
}

export async function withdrawOnSuccess(): Promise<void> {

  const byteArray = [8];
  const list = [Buffer.from(byteArray)];
  const buffer = Buffer.concat(list);

  const bidderKeyPairPath = path.resolve(__dirname, '../../dist/bidder/bidder-keypair.json')
  const bidderAccount = await readAccountFromFile(bidderKeyPairPath)
  const bidderPubKey = bidderAccount.publicKey

  const listerKeyPairPath = path.resolve(__dirname, '../../dist/lister/lister-keypair.json')
  const listerAccount = await readAccountFromFile(listerKeyPairPath)
  const listerPubKey = listerAccount.publicKey

  const tokenMintPubKey = new PublicKey('Fn386evLgVty7pBneoYF1shVWGZE8eqrA6fw9j8xLfDU');
  const tokenAccountPubKey = await findAssociatedTokenAddress(bidderPubKey, tokenMintPubKey);
  const listEscrowStatePubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    listerPubKey.toBuffer(),
    Buffer.from("List"),
    Buffer.from("State")
  ], programId))[0];
  const listEscrowVaultPubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    listerPubKey.toBuffer(),
    Buffer.from("List"),
    Buffer.from("Vault")
  ], programId))[0];

  const instruction = new TransactionInstruction({
    keys: [
      {pubkey: bidderPubKey, isSigner: true, isWritable: false},
      {pubkey: tokenAccountPubKey, isSigner: false, isWritable: true},
      {pubkey: tokenMintPubKey, isSigner: false, isWritable: true},
      {pubkey: listerPubKey, isSigner: false, isWritable: true},
      {pubkey: listEscrowStatePubkey, isSigner: false, isWritable: true},
      {pubkey: listEscrowVaultPubkey, isSigner: false, isWritable: true},
      {pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false}
    ],
    programId,
    data: buffer,
  });
  console.log('Sending transaction for update')
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [bidderAccount],
  );
}

export async function refund(): Promise<void> {

  const byteArray = [9];
  const list = [Buffer.from(byteArray)];
  const buffer = Buffer.concat(list);

  const tokenMintPubKey = new PublicKey('Fn386evLgVty7pBneoYF1shVWGZE8eqrA6fw9j8xLfDU');

  const keyPairPath = path.resolve(__dirname, '../../dist/bidder/bidder-keypair.json')
  const bidderAccount = await readAccountFromFile(keyPairPath)
  const bidderPubKey = bidderAccount.publicKey

  const programStatePubkey = (await PublicKey.findProgramAddress([
    Buffer.from("Platform"),
    Buffer.from("State")
  ], programId))[0];

  const escrowStatePubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    bidderPubKey.toBuffer(),
    Buffer.from("Bid"),
    Buffer.from("State")
  ], programId))[0];
  const escrowVaultPubkey = (await PublicKey.findProgramAddress([
    tokenMintPubKey.toBuffer(), 
    bidderPubKey.toBuffer(),
    Buffer.from("Bid"),
    Buffer.from("Vault")
  ], programId))[0];

  const instruction = new TransactionInstruction({
    keys: [
      {pubkey: payerAccount.publicKey, isSigner: true, isWritable: false},
      {pubkey: tokenMintPubKey, isSigner: false, isWritable: true},
      {pubkey: bidderPubKey, isSigner: false, isWritable: true},
      {pubkey: programStatePubkey, isSigner: false, isWritable: false},
      {pubkey: escrowStatePubkey, isSigner: false, isWritable: true},
      {pubkey: escrowVaultPubkey, isSigner: false, isWritable: true}
    ],
    programId,
    data: buffer,
  });
  console.log('Sending transaction for update')
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(instruction),
    [payerAccount],
  );
}