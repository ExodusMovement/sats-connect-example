import { base64, hex } from "@scure/base";
import * as btc from "@scure/btc-signer";

import { BitcoinNetworkType } from "sats-connect";
import type { Bytes, NETWORK } from "@scure/btc-signer";

export type UTXO = {
  txid: string;
  vout: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  value: number;
};

export const getUTXOs = async (
  network: BitcoinNetworkType,
  address: string
): Promise<UTXO[]> => {
  const networkSubpath =
    network === BitcoinNetworkType.Testnet ? "/testnet" : "";

  const url = `https://mempool.space${networkSubpath}/api/address/${address}/utxo`;
  const response = await fetch(url);

  return response.json();
};

export const createSelfSendPSBT = async ({
 unspentOutputs,
 publicKeyString,
 recipient,
 inputType,
} : {
  unspentOutputs: UTXO[],
  recipient: string
  publicKeyString: string
  inputType: string
}) => {
  const network = btc.NETWORK
  const publicKey = hex.decode(publicKeyString)

  // choose first unspent output
  const utxo = unspentOutputs[0]

  const tx = new btc.Transaction()

  // set transfer amount and calculate change
  const fee = 300 // set the miner fee amount
  const recipientAmount = BigInt(Math.min(utxo.value, 3000)) - BigInt(fee)
  const changeAmount = BigInt(utxo.value) - recipientAmount - BigInt(fee)

  tx.addInput(
      // @ts-ignore
      createInput({
        inputType,
        publicKey,
        network,
        utxo,
      })
  )

  tx.addOutputAddress(recipient, recipientAmount, network)
  tx.addOutputAddress(recipient, changeAmount, network)

  const psbt = tx.toPSBT(0)
  const psbtB64 = base64.encode(psbt)
  return psbtB64
}

const createInput = ({ inputType, publicKey, network, utxo }: { inputType: string, publicKey: Bytes, network: typeof NETWORK, utxo: UTXO }) => {
  if (inputType === 'p2wpkh') {
    const p2wpkh = btc.p2wpkh(publicKey, network)

    return {
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: p2wpkh.script,
        amount: BigInt(utxo.value),
      },
      sighashType: btc.SignatureHash.ALL | btc.SignatureHash.ANYONECANPAY,
    }
  }

  if (inputType === 'p2tr') {
    const internalPubKey = publicKey.slice(1, 33)
    const p2tr = btc.p2tr(internalPubKey, undefined, network)

    return {
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: p2tr.script,
        amount: BigInt(utxo.value),
      },
      tapInternalKey: p2tr.tapInternalKey,
      sighashType: btc.SignatureHash.ALL | btc.SignatureHash.ANYONECANPAY,
    }
  }
}

export const createPSBT = async (
  networkType: BitcoinNetworkType,
  paymentPublicKeyString: string,
  ordinalsPublicKeyString: string,
  paymentUnspentOutputs: UTXO[],
  ordinalsUnspentOutputs: UTXO[],
  recipient1: string,
  recipient2: string
) => {
  const network =
    networkType === BitcoinNetworkType.Testnet ? btc.TEST_NETWORK : btc.NETWORK;

  // choose first unspent output
  const paymentOutput = paymentUnspentOutputs[0];
  const ordinalOutput = ordinalsUnspentOutputs[0];

  const paymentPublicKey = hex.decode(paymentPublicKeyString);
  const ordinalPublicKey = hex.decode(ordinalsPublicKeyString);

  const tx = new btc.Transaction();

  // create segwit spend
  const p2wpkh = btc.p2wpkh(paymentPublicKey, network);
  const p2sh = btc.p2sh(p2wpkh, network);

  // create taproot spend
  const p2tr = btc.p2tr(ordinalPublicKey, undefined, network);

  // set transfer amount and calculate change
  const fee = 300n; // set the miner fee amount
  const recipient1Amount = BigInt(Math.min(paymentOutput.value, 3000)) - fee;
  const recipient2Amount = BigInt(Math.min(ordinalOutput.value, 3000));
  const total = recipient1Amount + recipient2Amount;
  const changeAmount =
    BigInt(paymentOutput.value) + BigInt(ordinalOutput.value) - total - fee;

  // payment input
  tx.addInput({
    txid: paymentOutput.txid,
    index: paymentOutput.vout,
    witnessUtxo: {
      script: p2sh.script ? p2sh.script : Buffer.alloc(0),
      amount: BigInt(paymentOutput.value),
    },
    redeemScript: p2sh.redeemScript ? p2sh.redeemScript : Buffer.alloc(0),
    witnessScript: p2sh.witnessScript,
    sighashType: btc.SignatureHash.SINGLE | btc.SignatureHash.ANYONECANPAY,
  });

  // ordinals input
  tx.addInput({
    txid: ordinalOutput.txid,
    index: ordinalOutput.vout,
    witnessUtxo: {
      script: p2tr.script,
      amount: BigInt(ordinalOutput.value),
    },
    tapInternalKey: ordinalPublicKey,
    sighashType: btc.SignatureHash.SINGLE | btc.SignatureHash.ANYONECANPAY,
  });

  tx.addOutputAddress(recipient1, recipient1Amount, network);
  tx.addOutputAddress(recipient2, recipient2Amount, network);
  tx.addOutputAddress(recipient2, changeAmount, network);

  const psbt = tx.toPSBT(0);
  const psbtB64 = base64.encode(psbt);
  return psbtB64;
};
