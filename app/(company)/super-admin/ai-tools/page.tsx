export default function AIToolsPage() {
  const aiServices = [
    {
      name: 'Deepseek',
      status: 'Configured',
      icon: '🤖',
      description: 'Translation and general-purpose AI',
      endpoint: 'api.deepseek.com',
      usage: 'Text translation, property analysis',
    },
    {
      name: 'Google Gemini',
      status: 'Configured',
      icon: '✨',
      description: 'Advanced content generation',
      endpoint: 'generativelanguage.googleapis.com',
      usage: 'Maintenance recommendations, summaries',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI Tools Configuration</h1>
        <p className="text-gray-600 mt-1">Manage AI services and API configurations</p>
      </div>

      {/* AI Services */}
      <div className="space-y-4">
        {aiServices.map((service) => (
          <div key={service.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="text-4xl">{service.icon}</div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{service.name}</h3>
                  <p className="text-gray-600 mt-1">{service.description}</p>
                  <div className="mt-4 space-y-2">
                    <p className="text-sm">
                      <strong>Status:</strong>{' '}
                      <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                        {service.status}
                      </span>
                    </p>
                    <p className="text-sm">
                      <strong>Endpoint:</strong> <code className="bg-gray-100 px-2 py-1 rounded text-xs">{service.endpoint}</code>
                    </p>
                    <p className="text-sm">
                      <strong>Usage:</strong> {service.usage}
                    </p>
                  </div>
                </div>
              </div>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* API Keys Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">API Keys & Credentials</h2>
        <p className="text-gray-600 mb-4">
          API keys are securely stored and managed. Update them here if needed.
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Deepseek API Key</p>
              <p className="text-sm text-gray-600">sk_*** (hidden for security)</p>
            </div>
            <button className="text-blue-600 hover:text-blue-700 font-medium">Update</button>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Gemini API Key</p>
              <p className="text-sm text-gray-600">AIza*** (hidden for security)</p>
            </div>
            <button className="text-blue-600 hover:text-blue-700 font-medium">Update</button>
          </div>
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Deepseek Usage (This Month)</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-gray-600">Tokens Used</p>
              <p className="font-semibold">1.2M</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-gray-600">API Calls</p>
              <p className="font-semibold">342</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-gray-600">Cost</p>
              <p className="font-semibold">€2.40</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gemini Usage (This Month)</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-gray-600">Tokens Used</p>
              <p className="font-semibold">856K</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-gray-600">API Calls</p>
              <p className="font-semibold">218</p>
            </div>
            <div className="flex justify-between items-center">
              <p className="text-gray-600">Cost</p>
              <p className="font-semibold">€1.95</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
