export const PUBLIC_CONTACT = {
  brandName: "DarkMoney",
  supportEmail: "joradrianmori@gmail.com",
  supportPhoneDisplay: "981 990 691",
  supportPhoneRaw: "51981990691",
  cityCountry: "Chiclayo, Peru",
  taxIdLabel: "RUC",
  taxIdValue: "10729731507",
  claimsBookPath: "/libro-reclamaciones",
} as const;

export const PUBLIC_CONTACT_LINKS = {
  email: `mailto:${PUBLIC_CONTACT.supportEmail}`,
  phone: `tel:+${PUBLIC_CONTACT.supportPhoneRaw}`,
  whatsapp: `https://wa.me/${PUBLIC_CONTACT.supportPhoneRaw}`,
} as const;
