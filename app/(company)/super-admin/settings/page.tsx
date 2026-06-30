export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-1">Configure global system settings and preferences</p>
      </div>

      {/* General Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">General Settings</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Application Name</label>
            <input
              type="text"
              defaultValue="PropertyPro"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Support Email</label>
            <input
              type="email"
              defaultValue="support@propertypro.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Default Language</label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Greek (Ελληνικά)</option>
              <option>English</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Timezone</label>
            <select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Europe/Athens (UTC+2)</option>
              <option>Europe/London (UTC+0)</option>
              <option>Europe/Paris (UTC+1)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trial Settings */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Trial Settings</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Default Trial Duration (days)</label>
            <input
              type="number"
              defaultValue="14"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Trial Reminder (days before expiry)</label>
            <input
              type="number"
              defaultValue="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Feature Flags</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium text-gray-900">New User Registration</p>
              <p className="text-sm text-gray-600">Allow new users to sign up</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Maintenance Features</p>
              <p className="text-sm text-gray-600">Enable maintenance request system</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium text-gray-900">AI Features</p>
              <p className="text-sm text-gray-600">Enable AI-powered tools and analysis</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Data & Privacy</h2>
        <div className="space-y-4">
          <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-left text-gray-900 font-medium">
            Export System Data
          </button>
          <button className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-left text-gray-900 font-medium">
            View Privacy Policy
          </button>
          <button className="w-full px-4 py-2 border border-red-300 rounded-lg hover:bg-red-50 text-left text-red-600 font-medium">
            Delete Logs Older Than 90 Days
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-4">
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          Save Changes
        </button>
        <button className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium">
          Cancel
        </button>
      </div>
    </div>
  );
}
