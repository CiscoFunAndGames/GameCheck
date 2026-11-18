#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  SUPPORTED_COUNTRIES,
  getFirewallPermissionStatus,
  setFirewallPermission,
  verifyFirewallAndNetworkRules,
  evaluateSellerReputation,
  filterSafeDeals,
  searchComponentDeals
} = require('../src/price-finder');

async function runTests() {
  console.log('Running Country-Aware Price & Verified Deals Finder Suite...');

  // 1. Firewall & Outbound Network Permission Gate Enforcement
  {
    setFirewallPermission(false);
    const initialStatus = getFirewallPermissionStatus();
    assert.strictEqual(initialStatus.granted, false, 'Firewall permission should start revoked/false');
    assert.ok(Array.isArray(initialStatus.allowedHosts) && initialStatus.allowedHosts.includes('www.hardgamers.com.ar'));
    assert.ok(initialStatus.allowedHosts.includes('compragamer.com'));

    const ruleBlocked = verifyFirewallAndNetworkRules('https://www.hardgamers.com.ar/search?text=rx+7600');
    assert.strictEqual(ruleBlocked.allowed, false);
    assert.strictEqual(ruleBlocked.reason, 'FIREWALL_PERMISSION_REQUIRED');

    const blockedSearch = await searchComponentDeals({
      query: 'AMD Radeon RX 7600',
      country: 'AR'
    });
    assert.strictEqual(blockedSearch.error, 'FIREWALL_PERMISSION_REQUIRED');
    assert.strictEqual(blockedSearch.requiresPermission, true);

    // Grant firewall permission
    const grantedStatus = setFirewallPermission(true, 'user-dialog-approved');
    assert.strictEqual(grantedStatus.granted, true);
    assert.ok(grantedStatus.grantedAt);

    const ruleAllowed = verifyFirewallAndNetworkRules('https://compragamer.com/?seccion=3&criterio=RTX+4070');
    assert.strictEqual(ruleAllowed.allowed, true);

    // Non-HTTPS or untrusted host should still be rejected by verifyFirewallAndNetworkRules
    const httpRejected = verifyFirewallAndNetworkRules('http://compragamer.com/?seccion=3');
    assert.strictEqual(httpRejected.allowed, false);
    assert.strictEqual(httpRejected.reason, 'HTTPS_REQUIRED');

    const unknownHostRejected = verifyFirewallAndNetworkRules('https://untrusted-scam-gpu-shop.example.com/deal');
    assert.strictEqual(unknownHostRejected.allowed, false);
    assert.strictEqual(unknownHostRejected.reason, 'HOST_NOT_IN_ALLOWLIST');

    console.log('  ✓ Firewall & Outbound HTTPS Allowlist gate enforced (blocks unauthorized, allows verified HTTPS hosts)');
  }

  // 2. Argentina (AR) GPU Search & Verified Official Stores Verification
  {
    const arDealsRes = await searchComponentDeals({
      query: 'AMD Radeon RX 7600',
      country: 'AR',
      strictReputation: true,
      firewallAuthorized: true,
      skipLiveNetwork: true
    });

    assert.strictEqual(arDealsRes.status, 'OK');
    assert.strictEqual(arDealsRes.country, 'AR');
    assert.strictEqual(arDealsRes.currency, 'ARS');
    assert.strictEqual(arDealsRes.firewallAuthorized, true);
    assert.ok(Array.isArray(arDealsRes.deals) && arDealsRes.deals.length >= 7, 'Expected at least 7 verified AR deals/stores');

    const storeNames = arDealsRes.deals.map((d) => d.storeName).join(' | ');
    assert.ok(storeNames.includes('HardGamers Argentina'), 'Expected HardGamers Argentina in AR results');
    assert.ok(storeNames.includes('Compra Gamer'), 'Expected Compra Gamer in AR results');
    assert.ok(storeNames.includes('Maximus Gaming Hardware'), 'Expected Maximus in AR results');
    assert.ok(storeNames.includes('Venex Computación'), 'Expected Venex in AR results');
    assert.ok(storeNames.includes('FullH4rd'), 'Expected FullH4rd in AR results');
    assert.ok(storeNames.includes('Mexx Computación'), 'Expected Mexx in AR results');
    assert.ok(storeNames.includes('MercadoLibre Argentina'), 'Expected MercadoLibre Official filter in AR results');

    for (const deal of arDealsRes.deals) {
      assert.ok(deal.url && deal.url.startsWith('https://'), `Deal URL must be HTTPS: ${deal.url}`);
      assert.strictEqual(deal.currency, 'ARS');
      assert.ok(deal.price > 100000, `Expected realistic ARS price > 100,000 for GPU in Argentina, got ${deal.price}`);
      assert.ok(deal.trustScore >= 9.0, `Every verified deal must have trustScore >= 9.0, got ${deal.trustScore}`);
      assert.ok(deal.formattedPrice.includes('ARS $'), `Expected formattedPrice to include ARS $, got ${deal.formattedPrice}`);
    }

    assert.ok(
      arDealsRes.reputationAudit.blockedBadReputationCount >= 3,
      'Expected reputation audit to block simulated unverified/mining/scam sellers'
    );
    console.log(
      `  ✓ Argentina (AR) GPU search verified: ${arDealsRes.deals.length} official AR stores (${arDealsRes.deals[0].storeName} @ ${arDealsRes.deals[0].formattedPrice}) & ${arDealsRes.reputationAudit.blockedBadReputationCount} risky sellers blocked`
    );
  }

  // 3. Multi-Country Support Verification (US, BR, CL, MX, ES)
  {
    const countriesToVerify = ['US', 'BR', 'CL', 'MX', 'ES'];
    for (const code of countriesToVerify) {
      assert.ok(SUPPORTED_COUNTRIES[code], `Expected SUPPORTED_COUNTRIES.${code} to exist`);
      const res = await searchComponentDeals({
        query: 'NVIDIA RTX 4070 Super',
        country: code,
        firewallAuthorized: true,
        skipLiveNetwork: true
      });
      assert.strictEqual(res.status, 'OK');
      assert.strictEqual(res.country, code);
      assert.ok(res.deals.length >= 3, `Expected at least 3 verified deals for ${code}`);
      assert.ok(res.deals.every((d) => d.url.startsWith('https://') && d.trustScore >= 9.0));
    }
    console.log('  ✓ Multi-country price & store verification passed for US, BR, CL, MX, and ES');
  }

  // 4. Seller Reputation & Anti-Scam Filter (evaluateSellerReputation & filterSafeDeals)
  {
    const marketRefArs = 420000;

    const officialGood = evaluateSellerReputation(
      {
        title: 'AMD Radeon RX 7600 8GB GDDR6 Nuevo',
        price: 398000,
        condition: 'new',
        sellerRating: 9.8,
        positiveRatingPct: 98,
        completedSales: 12000,
        isOfficialStore: true
      },
      marketRefArs
    );
    assert.strictEqual(officialGood.approved, true);

    const lowRatingSeller = evaluateSellerReputation(
      {
        title: 'AMD Radeon RX 7600 8GB',
        price: 390000,
        condition: 'new',
        sellerRating: 7.4,
        positiveRatingPct: 74,
        completedSales: 120,
        isOfficialStore: false
      },
      marketRefArs
    );
    assert.strictEqual(lowRatingSeller.approved, false);
    assert.ok(lowRatingSeller.flags.includes('LOW_SELLER_REPUTATION'));

    const zeroSalesSeller = evaluateSellerReputation(
      {
        title: 'AMD Radeon RX 7600 8GB',
        price: 395000,
        condition: 'new',
        sellerRating: 9.2,
        positiveRatingPct: 92,
        completedSales: 0,
        isOfficialStore: false
      },
      marketRefArs
    );
    assert.strictEqual(zeroSalesSeller.approved, false);
    assert.ok(zeroSalesSeller.flags.includes('INSUFFICIENT_SALES_HISTORY'));

    const minedCardSeller = evaluateSellerReputation(
      {
        title: 'Placa de Video RX 7600 Usada en Minería Sin Garantía',
        price: 310000,
        condition: 'mined',
        sellerRating: 9.5,
        positiveRatingPct: 95,
        completedSales: 400,
        isOfficialStore: false
      },
      marketRefArs
    );
    assert.strictEqual(minedCardSeller.approved, false);
    assert.ok(minedCardSeller.flags.includes('UNVERIFIED_USED_OR_MINED_HARDWARE'));

    const scamPriceListing = evaluateSellerReputation(
      {
        title: 'NVIDIA RTX 4070 Super Liquidación Increíble',
        price: 110000, // < 55% of 420,000
        condition: 'new',
        sellerRating: 9.4,
        positiveRatingPct: 94,
        completedSales: 200,
        isOfficialStore: false
      },
      marketRefArs
    );
    assert.strictEqual(scamPriceListing.approved, false);
    assert.ok(scamPriceListing.flags.includes('SUSPICIOUS_LOW_PRICE_SCAM'));

    const batchFiltered = filterSafeDeals(
      [
        { id: 'good-1', title: 'Compra Gamer RX 7600', price: 399000, condition: 'new', sellerRating: 9.8, completedSales: 50000, isOfficialStore: true },
        { id: 'bad-rep', title: 'Vendedor Malo', price: 380000, condition: 'new', sellerRating: 6.2, completedSales: 12, isOfficialStore: false },
        { id: 'bad-mined', title: 'GPU Usada Mineria', price: 300000, condition: 'used', sellerRating: 9.3, completedSales: 80, isOfficialStore: false },
        { id: 'bad-scam', title: 'Oferta Estafa', price: 95000, condition: 'new', sellerRating: 9.5, completedSales: 90, isOfficialStore: false }
      ],
      { marketRefPrice: marketRefArs, strictReputation: true }
    );

    assert.strictEqual(batchFiltered.verifiedDeals.length, 1);
    assert.strictEqual(batchFiltered.verifiedDeals[0].id, 'good-1');
    assert.strictEqual(batchFiltered.reputationAudit.blockedBadReputationCount, 3);
    console.log('  ✓ Seller Reputation & Anti-Scam filter verified (blocks <90% rating, <50 sales, mined/used GPUs, and <55% price scams)');
  }

  // Leave permission in clean default state
  setFirewallPermission(false);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
