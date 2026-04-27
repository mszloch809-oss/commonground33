const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const FIREBASE_DB_URL = process.env.FIREBASE_DB_URL;

const VENDORS = [
  {
    id: 1,
    name: "Doherty Plumbing",
    contact: "Joe Doherty",
    trade: "plumbing",
    phone: "+16178940445",
    preferred: true
  },
  {
    id: 2,
    name: "Szloch Electric",
    contact: "Mike Szloch",
    trade: "electrical",
    phone: "+17817062034",
    preferred: true
  },
  {
    id: 3,
    name: "AirCare HVAC",
    contact: "AirCare",
    trade: "hvac",
    phone: "+15085550303",
    preferred: false
  },
  {
    id: 4,
    name: "HandyPro Services",
    contact: "HandyPro",
    trade: "general",
    phone: "+15085550606",
    preferred: false
  }
];

const PROPERTY_NAMES = {
  cottage: "123 Main St",
  main: "24 Marlborough St",
  elm: "76 Forest St"
};

const KEYWORDS = {
  plumbing:
