export type StoreLocation = {
  id: string;
  name: string;
  kind: "store" | "outlet" | "spa" | "cafe" | "distributor" | "retailer";
  address: string;
  city: string;
  region: string;
  country: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  lat: number | null;
  lng: number | null;
};
