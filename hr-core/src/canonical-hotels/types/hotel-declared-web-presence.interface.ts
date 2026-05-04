import { HOTEL_DECLARED_WEBSITE_KIND } from '../constants/hotel-declared-website-kind.enum';
import { HOTEL_WEB_PRESENCE_SOURCE } from '../constants/hotel-web-presence-source.enum';

export interface IHotelDeclaredWebPresence {
  source: HOTEL_WEB_PRESENCE_SOURCE;
  websites: string[];
  domains: string[];
  hasDeclaredWebsite: boolean;
  declaredWebsiteKind: HOTEL_DECLARED_WEBSITE_KIND;
  issues: string[];
}
