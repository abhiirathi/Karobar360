// Where sales enquiries go. Change these to route WhatsApp and email somewhere else.
export const SALES = {
  whatsapp: "918503863962",
  phoneLabel: "+91 85038 63962",
  email: "iamabhirathi@gmail.com",
};

export const waLink = (text: string) => `https://wa.me/${SALES.whatsapp}?text=${encodeURIComponent(text)}`;
export const mailLink = (subject: string, body = "") => `mailto:${SALES.email}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`;
