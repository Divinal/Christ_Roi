import React, { useState } from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import PublicLayout from '../components/PublicLayout';
import { PublicPage } from '../components/PublicHeader';
import { siteConfig } from '../config/site.config';
import { t } from '../i18n';

interface ContactPageProps {
  onNavigate: (page: PublicPage) => void;
  onLoginClick: () => void;
}

const ContactPage: React.FC<ContactPageProps> = ({ onNavigate, onLoginClick }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const subject = encodeURIComponent(t("Message de {0} via le site", [name]));
    const body = encodeURIComponent(t("{0}\n\nRépondre à : {1}", [message, email]));
    window.location.href = `mailto:${siteConfig.contact.email}?subject=${subject}&body=${body}`;
  };

  return (
    <PublicLayout currentPage="contact" onNavigate={onNavigate} onLoginClick={onLoginClick}>
      <section className="container mx-auto px-4 lg:px-8 py-16 md:py-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 text-center">{t("Contactez-nous")}</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            {t("Une question sur")} {t(siteConfig.schoolName)} {t("? Écrivez-nous, nous vous répondrons rapidement.")}
          </p>

          <div className="grid md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <MapPin className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{t("Adresse")}</h3>
                  {siteConfig.contact.addressLines.map((line) => (
                    <p key={line} className="text-gray-600 text-sm">{t(line)}</p>
                  ))}
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{t("Email")}</h3>
                  <a href={`mailto:${siteConfig.contact.email}`} className="text-gray-600 text-sm hover:text-blue-600">
                    {siteConfig.contact.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{t("Téléphone")}</h3>
                  <a
                    href={`tel:${siteConfig.contact.phone.replace(/\s/g, '')}`}
                    className="text-gray-600 text-sm hover:text-blue-600"
                  >
                    {siteConfig.contact.phone}
                  </a>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("Nom")}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("Email")}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("Message")}</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-md"
              >
                {t("Envoyer")}
              </button>
            </form>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default ContactPage;
