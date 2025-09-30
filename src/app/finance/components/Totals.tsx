export default function Totals({ data }: { data: any }) {
  const mutualFundsTotal = data.mutualFunds.reduce((acc: number, mf: any) => {
    for (const [_, funds] of Object.entries(mf)) {
      for (const f of funds as any[]) {
        acc += f.units * f.price;
      }
    }
    return acc;
  }, 0);

  const remoteTotal = data.remoteBanks.reduce(
    (acc: number, b: any) => acc + b.amountUsd * b.exchangeRate,
    0
  );

  const localTotal = data.localBanks.reduce((acc: number, b: any) => acc + b.amountPkr, 0);

  return (
    <div className="bg-gray-100 p-4 rounded">
      <h2 className="text-xl font-semibold mb-2">Totals</h2>
      <p>Mutual Funds Total: {mutualFundsTotal}</p>
      <p>Remote Banks Total: {remoteTotal}</p>
      <p>Local Banks Total: {localTotal}</p>
      <p className="font-bold mt-2">Grand Total: {mutualFundsTotal + remoteTotal + localTotal}</p>
    </div>
  );
}
