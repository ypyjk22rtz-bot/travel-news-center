export type SourceKind = "airline" | "airport" | "tourism" | "authority" | "publication";
export type SourceMethod = "rss" | "web" | "api";

export type TravelSource = {
  id: string;
  name: string;
  country: string;
  kind: SourceKind;
  method: SourceMethod;
  url: string;
  feedUrl?: string;
  active: boolean;
  frequencyMinutes: number;
};

export const initialSources: TravelSource[] = [
  { id: "iata-news", name: "IATA News", country: "Global", kind: "authority", method: "web", url: "https://www.iata.org/en/pressroom/", active: true, frequencyMinutes: 60 },
  { id: "easa-news", name: "EASA Newsroom", country: "Europa", kind: "authority", method: "web", url: "https://www.easa.europa.eu/en/newsroom-and-events", active: true, frequencyMinutes: 60 },
  { id: "ec-mobility", name: "European Commission Mobility", country: "Uniunea Europeană", kind: "authority", method: "web", url: "https://transport.ec.europa.eu/news-events/news_en", active: true, frequencyMinutes: 60 },
  { id: "singapore-airlines", name: "Singapore Airlines Newsroom", country: "Singapore", kind: "airline", method: "web", url: "https://www.singaporeair.com/en_UK/us/media-centre/", active: true, frequencyMinutes: 60 },
  { id: "emirates", name: "Emirates Media Centre", country: "Emiratele Arabe Unite", kind: "airline", method: "web", url: "https://www.emirates.com/media-centre/", active: true, frequencyMinutes: 60 },
  { id: "heathrow", name: "Heathrow Media Centre", country: "Regatul Unit", kind: "airport", method: "web", url: "https://mediacentre.heathrow.com/", active: true, frequencyMinutes: 60 },
  { id: "schiphol", name: "Schiphol Newsroom", country: "Țările de Jos", kind: "airport", method: "web", url: "https://news.schiphol.com/", active: true, frequencyMinutes: 60 },
  { id: "japan-tourism", name: "Japan National Tourism Organization", country: "Japonia", kind: "tourism", method: "web", url: "https://www.japan.travel/en/news/", active: true, frequencyMinutes: 120 },
  { id: "thailand-tourism", name: "Tourism Authority of Thailand", country: "Thailanda", kind: "tourism", method: "web", url: "https://www.tatnews.org/", active: true, frequencyMinutes: 120 },
  { id: "travel-europe", name: "European Travel Commission", country: "Europa", kind: "tourism", method: "web", url: "https://etc-corporate.org/news/", active: true, frequencyMinutes: 120 },
  { id: "faa", name: "FAA Newsroom", country: "SUA", kind: "authority", method: "web", url: "https://www.faa.gov/newsroom", active: true, frequencyMinutes: 60 },
  { id: "icao", name: "ICAO Newsroom", country: "Global", kind: "authority", method: "web", url: "https://www.icao.int/Newsroom/Pages/default.aspx", active: true, frequencyMinutes: 60 }
];
