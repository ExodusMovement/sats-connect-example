import * as btc from "@scure/btc-signer";

import { signTransaction } from "sats-connect";

import { getUTXOs } from "../utils";

import type { BitcoinNetworkType, BitcoinProvider} from "sats-connect";

type Props = {
  title: string
  network: BitcoinNetworkType;
  address: string;
  publicKey: string;
  getProvider: () => Promise<BitcoinProvider>;
  createSelfSendPSBT: (args: any) => Promise<string>
};

const SignTransaction = ({
  title,
  network,
  address,
  publicKey,
  getProvider,
  createSelfSendPSBT
}: Props) => {
  const onSignTransactionClick = async () => {
    const unspentOutputs = await getUTXOs(network, address);

    let canContinue = true;

    if (unspentOutputs.length === 0) {
      alert(`No unspent outputs found for ${address} address`);
      canContinue = false;
    }

    if (!canContinue) {
      return;
    }

    // create psbt sending from the supplied address to itself
    const outputRecipient = address;

    const psbtBase64 = await createSelfSendPSBT({
      networkType: network,
      publicKeyString: publicKey,
      unspentOutputs,
      recipient: outputRecipient,
    });

    await signTransaction({
      payload: {
        network: {
          type: network,
        },
        message: "Sign Transaction",
        psbtBase64,
        broadcast: false,
        inputsToSign: [
          {
            address,
            signingIndexes: [0],
            sigHash: btc.SignatureHash.SINGLE | btc.SignatureHash.ANYONECANPAY,
          }
        ],
      },
      onFinish: (response) => {
        alert(response.psbtBase64);
        console.log(response)
      },
      onCancel: () => alert("Canceled"),
      getProvider,
    });
  };

  return (
    <div className="container">
      <h3>{title}</h3>
      <p>
        Creates a PSBT sending the first UTXO from {address} address to itself with the change.
      </p>
      <div>
        <button onClick={onSignTransactionClick}>Sign Transaction</button>
      </div>
    </div>
  );
};

export default SignTransaction;
