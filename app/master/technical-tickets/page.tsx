export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default function MasterTechnicalTicketsRedirect() {
  redirect('/master/tickets?category=technical_support');
}
