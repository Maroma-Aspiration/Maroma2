import { readJsonKv, writeJsonKv } from "./json-kv-store";

export type CareersApplication = {
  id: string;
  name: string;
  email: string;
  phone: string;
  area: string;
  startDate: string;
  duration: string;
  note: string;
  needs: string;
  cvLink: string;
  createdAt: string;
};

type ApplicationStore = { applications: CareersApplication[] };

const KEY = "maroma:careers-applications";
const FILE = "careers-applications.json";

const empty = (): ApplicationStore => ({ applications: [] });

export async function submitCareersApplication(input: Omit<CareersApplication, "id" | "createdAt">): Promise<CareersApplication> {
  const store = (await readJsonKv<ApplicationStore>(KEY, FILE, empty())) ?? empty();
  const application: CareersApplication = {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    phone: input.phone,
    area: input.area,
    startDate: input.startDate,
    duration: input.duration,
    note: input.note,
    needs: input.needs,
    cvLink: input.cvLink,
    createdAt: new Date().toISOString(),
  };
  store.applications = [application, ...(store.applications ?? [])].slice(0, 1000);
  await writeJsonKv(KEY, FILE, store);
  return application;
}
