const fs = require('fs');
const parse = require('csv-parse');

const debug = 10;

const STATUS_PAID = 'Paid';
const STATUS_REFUNDED = 'Refunded';
const STATUS_FAILED = 'Failed';

const docs = () => {
  console.log(`usage: node ${process.argv[1].split('/').pop()} csv_file`);
};

if (process.argv.length !== 3) {
  console.log('Error: Incorrect number of arguments');
  docs();
  process.exit(1);
}

const csvFile = process.argv[2];
const inputStream = fs.createReadStream(csvFile);
const csvStream = inputStream.pipe(parse({ delimiter: ',' }));

const charges = [];

// Rough structure description
const audit = {
  totals: {
    revenue: {},
    paid: {},
    refunded: {},
    charges: {},
    payments: {},
    refunds: {},
    failures: {},
  },

  // years: [{
  //   year: 2016,
  //   // same stats as totals
  //   months: [{
  //     month: 1,
  //     // same stats as totals
  //   }],
  // }],
};

csvStream.on('data', (chunk) => {
  const id = chunk[0]; // Charge ID

  if (id === 'id') return;

  const status = chunk[12]; // Paid/Refunded/Failed
  const amount = Number(chunk[3]); // In $/£/€
  const currency = chunk[5]; // ISO currency code
  const created = (new Date(chunk[2])).toISOString();

  const charge = {
    id,
    status,
    amount,
    currency,
    created,
  };

  if (debug > 1) console.log(`${charge.created} ${charge.currency} ${charge.amount}`);
  if (debug > 2) console.log(`charge = ${JSON.stringify(charge, null, 2)}\n`);

  charges.push(charge);
});

csvStream.on('end', () => {
  const currencies = [];
  // Example: ['usd', 'gbp', 'eur'];
  // Pre-process to get the currencies used.
  charges.forEach((charge) => {
    if (!currencies.includes(charge.currency)) {
      currencies.push(charge.currency);
      if (debug > 1) console.log(`Found currency: ${charge.currency}`);
    }
  });

  if (debug > 1) console.log(`currencies = ${JSON.stringify(currencies, null, 2)}\n`);

  // Build the structure
  currencies.forEach((currency) => {
    // Balances
    audit.totals.revenue[currency] = 0;
    audit.totals.paid[currency] = 0;
    audit.totals.refunded[currency] = 0;
    // Occurences
    audit.totals.charges[currency] = 0;
    audit.totals.payments[currency] = 0;
    audit.totals.refunds[currency] = 0;
    audit.totals.failures[currency] = 0;
    if (debug > 1) console.log(`Init currency: ${currency}`);
  });

  // Process
  charges.forEach((charge) => {
    audit.totals.charges[charge.currency] += 1;
    if (charge.status === STATUS_PAID) {
      audit.totals.revenue[charge.currency] += charge.amount;
      audit.totals.paid[charge.currency] += charge.amount;
      audit.totals.payments[charge.currency] += 1;
    } else if (charge.status === STATUS_REFUNDED) {
      audit.totals.revenue[charge.currency] -= charge.amount;
      audit.totals.refunded[charge.currency] += charge.amount;
      audit.totals.refunds[charge.currency] += 1;
    } else if (charge.status === STATUS_FAILED) {
      audit.totals.failures[charge.currency] += 1;
    }
  });

  if (debug > 1) console.log(`audit.totals = ${JSON.stringify(audit.totals, null, 2)}\n`);
});
