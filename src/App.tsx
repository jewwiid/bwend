import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BwendLandingPage } from './BwendLandingPage';
import { CallbackPage } from './pages/CallbackPage';
import { BlendPage } from './pages/BlendPage';
import { InvitePage } from './pages/InvitePage';
import { MatchPage } from './pages/MatchPage';
import { PrivacyPage } from './pages/PrivacyPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public product and privacy surfaces. */}
        <Route path="/" element={<BwendLandingPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* App. /m/:code is the shared invite link; when the iOS app is installed,
            Universal Links means iOS opens it before the browser gets here. */}
        <Route path="/callback" element={<CallbackPage />} />
        <Route path="/blend" element={<BlendPage />} />
        <Route path="/m/:code" element={<InvitePage />} />
        <Route path="/match/:id" element={<MatchPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
