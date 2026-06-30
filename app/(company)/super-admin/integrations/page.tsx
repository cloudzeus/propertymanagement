export default function IntegrationsPage() {
  const integrations = [
    {
      name: 'Mailgun',
      status: 'Connected',
      icon: '📧',
      description: 'Email service for notifications and OTP',
      details: 'Sending emails for password resets, OTP codes, and system notifications',
    },
    {
      name: 'BunnyCDN',
      status: 'Connected',
      icon: '📁',
      description: 'File storage and content delivery',
      details: 'Storing images, documents, and other files for companies',
    },
    {
      name: 'Deepseek API',
      status: 'Connected',
      icon: '🤖',
      description: 'AI-powered translations and analysis',
      details: 'Greek to English translations, property analysis, content summarization',
    },
    {
      name: 'Google Gemini',
      status: 'Connected',
      icon: '✨',
      description: 'Advanced AI generation',
      details: 'Maintenance recommendations, AI-powered insights',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600 mt-1">Manage external services and integrations</p>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((integration) => (
          <div key={integration.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <div className="text-3xl">{integration.icon}</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{integration.name}</h3>
                  <p className="text-sm text-gray-600">{integration.description}</p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  integration.status === 'Connected'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {integration.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">{integration.details}</p>
            <div className="flex gap-2">
              <button className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
                Configure
              </button>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
                Test
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* System Health */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Integration Health Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border-l-4 border-green-500 bg-green-50 rounded">
            <div>
              <p className="font-medium text-gray-900">Mailgun</p>
              <p className="text-sm text-gray-600">Last checked: 2 minutes ago</p>
            </div>
            <span className="text-green-600 font-semibold">✓ Healthy</span>
          </div>
          <div className="flex items-center justify-between p-3 border-l-4 border-green-500 bg-green-50 rounded">
            <div>
              <p className="font-medium text-gray-900">BunnyCDN</p>
              <p className="text-sm text-gray-600">Last checked: 5 minutes ago</p>
            </div>
            <span className="text-green-600 font-semibold">✓ Healthy</span>
          </div>
          <div className="flex items-center justify-between p-3 border-l-4 border-green-500 bg-green-50 rounded">
            <div>
              <p className="font-medium text-gray-900">AI APIs</p>
              <p className="text-sm text-gray-600">Last checked: 1 minute ago</p>
            </div>
            <span className="text-green-600 font-semibold">✓ Healthy</span>
          </div>
        </div>
      </div>

      {/* Webhook Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Webhooks</h2>
        <p className="text-gray-600 mb-4">
          Configure webhooks to receive notifications from external services.
        </p>
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          + Add Webhook
        </button>
      </div>
    </div>
  );
}
