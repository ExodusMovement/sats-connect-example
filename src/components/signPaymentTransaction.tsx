import * as btc from "@scure/btc-signer";

import { signTransaction } from "sats-connect";

import { createSelfSendPSBT, getUTXOs } from "../utils";

import type { BitcoinNetworkType, BitcoinProvider} from "sats-connect";

type Props = {
  network: BitcoinNetworkType;
  paymentAddress: string;
  paymentPublicKey: string;
  getProvider: () => Promise<BitcoinProvider>;
};

const SignTransaction = ({
  network,
  paymentAddress,
  paymentPublicKey,
  getProvider,
}: Props) => {
  const onSignTransactionClick = async () => {
    const paymentUnspentOutputs = await getUTXOs(network, paymentAddress);

    let canContinue = true;

    if (paymentUnspentOutputs.length === 0) {
      alert("No unspent outputs found for payment address");
      canContinue = false;
    }

    if (!canContinue) {
      return;
    }

    // create psbt sending from payment address to itself
    const outputRecipient = paymentAddress;

    const psbtBase64 = await createSelfSendPSBT({
      networkType: network,
      paymentPublicKeyString: paymentPublicKey,
      paymentUnspentOutputs,
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
            address: paymentAddress,
            signingIndexes: [0],
            sigHash: btc.SignatureHash.SINGLE | btc.SignatureHash.ANYONECANPAY,
          }
        ],
      },
      onFinish: (response) => {
        alert(response.psbtBase64);
      },
      onCancel: () => alert("Canceled"),
      getProvider,
    });
  };

  return (
    <div className="container">
      <h3>Sign a self-send transaction</h3>
      <p>
        Creates a PSBT sending the first UTXO from the payment address to itself with the change.
      </p>
      <div>
        <button onClick={onSignTransactionClick}>Sign Transaction</button>
      </div>
    </div>
  );
};

export default SignTransaction;
