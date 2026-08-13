export type AtsSource =
  | "greenhouse"
  | "flutterwave"
  | "nextrium"
  | "iksf"
  | "techyx360";

export interface AtsCompany {
  company: string;
  source: AtsSource;
  slug?: string;
  url?: string;
  active: boolean;
}

export const atsSources: AtsCompany[] = [
  {
    company: "Moniepoint",
    source: "greenhouse",
    slug: "moniepoint",
    active: true,
  },
  {
    company: "Flutterwave",
    source: "flutterwave",
    url: "https://flutterwave.com/ng/careers/vacancies",
    active: true,
  },
  {
    company: "NexTrium",
    source: "nextrium",
    url: "https://www.nextrium.org/careers",
    active: true,
  },
  {
    company: "IKSF",
    source: "iksf",
    url: "https://iksf.ng/careers/",
    active: true,
  },
  {
    company: "Techyx360",
    source: "techyx360",
    url: "https://techyx360.com/careers",
    active: true,
  },
];
