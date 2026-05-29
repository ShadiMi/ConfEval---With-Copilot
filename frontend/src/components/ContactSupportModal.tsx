'use client';

import { useEffect, useState } from 'react';
import { LifeBuoy, Mail, Phone } from 'lucide-react';
import Modal from './ui/Modal';
import { authApi } from '@/lib/api';
import { useHelpStore } from '@/lib/store';

export default function ContactSupportModal() {
  const { contactOpen, closeContact } = useHelpStore();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!contactOpen || loaded) return;
    let cancelled = false;
    (async () => {
      try {
        const [emailRes, phoneRes] = await Promise.all([
          authApi.getSetting('support_email'),
          authApi.getSetting('support_phone'),
        ]);
        if (cancelled) return;
        setEmail(emailRes.data?.value || '');
        setPhone(phoneRes.data?.value || '');
      } catch {
        // Non-fatal — show "not configured" state.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contactOpen, loaded]);

  return (
    <Modal isOpen={contactOpen} onClose={closeContact} title="Contact support" size="sm">
      <div className="space-y-4">
        <div className="flex items-center text-primary-800">
          <LifeBuoy className="w-5 h-5 mr-2" />
          <p className="text-sm font-medium">
            For technical issues or questions about ConfEval, reach the support team:
          </p>
        </div>

        {!loaded ? (
          <p className="text-sm text-slate-500">Loading contact info…</p>
        ) : email || phone ? (
          <ul className="space-y-2 text-sm">
            {email && (
              <li className="flex items-center text-slate-800">
                <Mail className="w-4 h-4 mr-2 text-slate-500" />
                <a
                  href={`mailto:${email}`}
                  className="text-primary-700 hover:text-primary-800 font-medium"
                >
                  {email}
                </a>
              </li>
            )}
            {phone && (
              <li className="flex items-center text-slate-800">
                <Phone className="w-4 h-4 mr-2 text-slate-500" />
                <a
                  href={`tel:${phone}`}
                  className="text-primary-700 hover:text-primary-800 font-medium"
                >
                  {phone}
                </a>
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 italic">
            Support contact info has not been configured yet. Please ask your
            administrator to add it under System Settings.
          </p>
        )}
      </div>
    </Modal>
  );
}
