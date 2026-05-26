export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default function MasterWhatsAppIntegrationRequestsRedirect() {
  redirect('/master/tickets?category=whatsapp_integration');
}
