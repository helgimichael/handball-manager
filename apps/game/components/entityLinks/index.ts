// HM-UX-0.3: barrel for the entity-navigation primitives. Extend this
// family with StaffLink/CoachLink/CompetitionLink later, following the
// exact same shape (an id prop, children, a pure hrefFor* helper
// alongside the component) -- never a one-off ad hoc Link.
export { ClubLink, clubProfileHref, type ClubLinkProps } from "./ClubLink";
export { PlayerLink, playerProfileHref, type PlayerLinkProps } from "./PlayerLink";
