import { Injectable } from '@nestjs/common';
import { IHotelContacts } from '../../hotel-registry-entries/types/hotel-contacts.interface';
import { HOTEL_DECLARED_WEBSITE_KIND } from '../constants/hotel-declared-website-kind.enum';
import { HOTEL_WEB_PRESENCE_SOURCE } from '../constants/hotel-web-presence-source.enum';
import { IHotelDeclaredWebPresence } from '../types/hotel-declared-web-presence.interface';

const GROUP_DOMAINS = new Set([
  'atlanticahotels.com',
  'kanikahotels.com',
  'leonardo-hotels-cyprus.com',
  'leonardo-hotels.com',
  'leonardo-hotels.co',
  'louis-hotels.com',
  'louishotels.com',
  'tsokkos.com',
]);

const SOCIAL_DOMAINS = new Set([
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'tiktok.com',
  'x.com',
]);

const AGGREGATOR_DOMAINS = new Set([
  'booking.com',
  'expedia.com',
  'hotels.com',
  'tripadvisor.com',
]);

@Injectable()
export class HotelDeclaredWebPresenceService {
  build(contacts: IHotelContacts): IHotelDeclaredWebPresence {
    const domains = this.uniqueSorted(contacts.domains);
    const websites = this.uniqueSorted(contacts.websites);
    const evidenceDomains = domains.length > 0 ? domains : websites;

    if (websites.length === 0 && domains.length === 0) {
      return this.buildPresence(
        websites,
        domains,
        HOTEL_DECLARED_WEBSITE_KIND.MISSING,
        ['missing_website'],
      );
    }

    if (evidenceDomains.every((domain) => this.isKnownDomain(domain, GROUP_DOMAINS))) {
      return this.buildPresence(
        websites,
        domains,
        HOTEL_DECLARED_WEBSITE_KIND.GROUP_WEBSITE,
        ['declared_group_website'],
      );
    }

    if (
      evidenceDomains.every((domain) =>
        this.isKnownDomain(domain, AGGREGATOR_DOMAINS),
      )
    ) {
      return this.buildPresence(
        websites,
        domains,
        HOTEL_DECLARED_WEBSITE_KIND.AGGREGATOR_OR_PORTAL,
        ['declared_aggregator_or_portal'],
      );
    }

    if (
      evidenceDomains.every((domain) => this.isKnownDomain(domain, SOCIAL_DOMAINS))
    ) {
      return this.buildPresence(
        websites,
        domains,
        HOTEL_DECLARED_WEBSITE_KIND.SOCIAL_ONLY,
        ['declared_social_only'],
      );
    }

    return this.buildPresence(
      websites,
      domains,
      HOTEL_DECLARED_WEBSITE_KIND.OWN_WEBSITE,
      [],
    );
  }

  private buildPresence(
    websites: string[],
    domains: string[],
    declaredWebsiteKind: HOTEL_DECLARED_WEBSITE_KIND,
    issues: string[],
  ): IHotelDeclaredWebPresence {
    return {
      declaredWebsiteKind,
      domains,
      hasDeclaredWebsite: websites.length > 0,
      issues,
      source: HOTEL_WEB_PRESENCE_SOURCE.GOV_REGISTRY,
      websites,
    };
  }

  private isKnownDomain(domain: string, knownDomains: Set<string>): boolean {
    const normalizedDomain = this.normalizeDomain(domain);

    return [...knownDomains].some(
      (knownDomain) =>
        normalizedDomain === knownDomain ||
        normalizedDomain.endsWith(`.${knownDomain}`),
    );
  }

  private normalizeDomain(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//u, '')
      .replace(/^www\./u, '')
      .replace(/\/.*$/u, '');
  }

  private uniqueSorted(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    );
  }
}
