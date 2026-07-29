import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { BwendLandingPage } from './BwendLandingPage';
import { CallbackPage } from './pages/CallbackPage';
import { BlendPage } from './pages/BlendPage';
import { InvitePage } from './pages/InvitePage';
import { MatchPage } from './pages/MatchPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Marketing site — unchanged. */}
        <Route path="/" element={<BwendLandingPage />} />

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
