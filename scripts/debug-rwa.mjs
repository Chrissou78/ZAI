const KEY = process.env.WALLETTWO_API_KEY;
if (!KEY) {
  console.error('Missing WALLETTWO_API_KEY');
  process.exit(1);
}

const BASE = 'https://rwa.onchainlabs.ch/v1/api';
const hdr = { 'x-api-key': KEY, 'Content-Type': 'application/json' };

async function go() {
  // 1. List all RWAs
  console.log('='.repeat(72));
  console.log('  1 - ALL RWAs');
  console.log('='.repeat(72));
  const r1 = await fetch(BASE + '/rwa?limit=200', { headers: hdr });
  const d1 = await r1.json();
  const rwas = d1.rwas || d1.data || [];
  console.log('  Total:', d1.total, ' Array length:', rwas.length);
  console.log('');
  console.log('  #   NAME                           TYPE         CLAIMABLE  BUYABLE  CONTRACT                                     CHAIN');
  console.log('  ' + '-'.repeat(120));
  const contracts = new Set();
  for (let i = 0; i < rwas.length; i++) {
    const r = rwas[i];
    const addr = r.smartContractAddress || r.contractAddress || '(none)';
    if (r.smartContractAddress) contracts.add(r.smartContractAddress.toLowerCase());
    console.log(
      '  ' +
      String(i + 1).padEnd(4) +
      (r.name || '').slice(0, 28).padEnd(30) +
      (r.type || '').padEnd(13) +
      String(!!r.isClaimable).padEnd(11) +
      String(!!r.isBuyable).padEnd(9) +
      addr.slice(0, 42).padEnd(44) +
      (r.chainId ?? '?')
    );
  }
  console.log('');
  console.log('  Unique contracts:', contracts.size);
  for (const c of contracts) console.log('    ' + c);

  // 2. All NFTs
  console.log('');
  console.log('='.repeat(72));
  console.log('  2 - ALL NFTs');
  console.log('='.repeat(72));
  const r2 = await fetch(BASE + '/nft?limit=200', { headers: hdr });
  const d2 = await r2.json();
  const nfts = d2.nfts || d2.data || [];
  console.log('  Total:', d2.total, ' Array length:', nfts.length);
  const byRwa = {};
  for (const n of nfts) {
    const k = n.rwaId || n.rwa?.id || '?';
    if (!byRwa[k]) byRwa[k] = { name: n.rwa?.name || '', total: 0, claimed: 0, unclaimed: 0 };
    byRwa[k].total++;
    if (n.isClaimed || n.mintedTx) byRwa[k].claimed++;
    else byRwa[k].unclaimed++;
  }
  console.log('');
  console.log('  RWA ID                                 NAME                      TOTAL  MINTED UNCLAIMED');
  console.log('  ' + '-'.repeat(100));
  for (const [id, g] of Object.entries(byRwa)) {
    console.log(
      '  ' +
      id.slice(0, 38).padEnd(41) +
      g.name.slice(0, 24).padEnd(26) +
      String(g.total).padEnd(7) +
      String(g.claimed).padEnd(7) +
      g.unclaimed
    );
  }

  // 3. Claimable only
  console.log('');
  console.log('='.repeat(72));
  console.log('  3 - CLAIMABLE ONLY');
  console.log('='.repeat(72));
  const r3 = await fetch(BASE + '/rwa?isClaimable=true&limit=200', { headers: hdr });
  const d3 = await r3.json();
  const claimable = d3.rwas || d3.data || [];
  console.log('  Claimable RWAs:', claimable.length);
  for (const r of claimable) {
    console.log('    ' + (r.name || '').slice(0, 35).padEnd(37) + 'contract: ' + (r.smartContractAddress || 'none'));
  }

  console.log('');
  console.log('='.repeat(72));
  console.log('  DONE');
  console.log('='.repeat(72));
}

go().catch(e => console.error('FATAL:', e));