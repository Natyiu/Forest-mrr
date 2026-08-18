declare module "geoip-country" {
  interface GeoLookup {
    country: string;
    name: string;
    native: string;
    phone: number[];
    continent: string;
    capital: string;
    currency: string[];
    languages: string[];
    continent_name: string;
  }

  function lookup(ip: string): GeoLookup | null;

  export default { lookup };
}
