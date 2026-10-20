import { Routes, Route, Navigate, useParams } from "react-router-dom";
import Layout from "./components/Layout";
import About from "./pages/About";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Plan from "./pages/Plan";
import Explore from "./pages/Explore";
import AllSites from "./pages/AllSites";
import MyTrips from "./pages/MyTrips";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import TripDetail from "./pages/TripDetail";
import CustomiseTrip from "./pages/CustomiseTrip";
import SharedTrip from "./pages/SharedTrip";
import { useProximityNotifications } from "./lib/useProximityNotifications";

// The standalone map page merged into TripDetail itself (itinerary + map side by side) -- this
// just catches any old bookmarked/shared links to the retired route.
function RedirectToTripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  return <Navigate to={`/trip/${tripId}`} replace />;
}

export default function App() {
  useProximityNotifications();

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<Navigate to="/plan" replace />} />
      <Route path="/shared/:tripId" element={<SharedTrip />} />

      <Route path="/about" element={<Layout><About /></Layout>} />
      <Route path="/blog" element={<Layout><Blog /></Layout>} />
      <Route path="/blog/:slug" element={<Layout><BlogPost /></Layout>} />
      <Route path="/plan" element={<Layout><Plan /></Layout>} />
      <Route path="/explore" element={<Layout><Explore /></Layout>} />
      <Route path="/all-sites" element={<Layout><AllSites /></Layout>} />
      <Route path="/my-trips" element={<Layout><MyTrips /></Layout>} />
      <Route path="/settings" element={<Layout><Settings /></Layout>} />
      <Route path="/trip/:tripId" element={<Layout><TripDetail /></Layout>} />
      <Route path="/trip/:tripId/map" element={<RedirectToTripDetail />} />
      <Route path="/trip/:tripId/customise" element={<Layout><CustomiseTrip /></Layout>} />
    </Routes>
  );
}
