import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./pages/Landing";
import About from "./pages/About";
import Plan from "./pages/Plan";
import Explore from "./pages/Explore";
import SiteDetail from "./pages/SiteDetail";
import TripMapBuilder from "./pages/TripMapBuilder";
import AllSites from "./pages/AllSites";
import MyTrips from "./pages/MyTrips";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import TripDetail from "./pages/TripDetail";
import CustomiseTrip from "./pages/CustomiseTrip";
import TripDetailSwapItem from "./pages/TripDetailSwapItem";
import { useProximityNotifications } from "./lib/useProximityNotifications";

export default function App() {
  useProximityNotifications();

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<Landing />} />

      <Route path="/about" element={<Layout><About /></Layout>} />
      <Route path="/plan" element={<Layout><Plan /></Layout>} />
      <Route path="/explore" element={<Layout><Explore /></Layout>} />
      <Route path="/site/:siteName" element={<Layout><SiteDetail /></Layout>} />
      <Route path="/all-sites" element={<Layout><AllSites /></Layout>} />
      <Route path="/my-trips" element={<Layout><MyTrips /></Layout>} />
      <Route path="/settings" element={<Layout><Settings /></Layout>} />
      <Route path="/trip/:tripId" element={<Layout><TripDetail /></Layout>} />
      <Route path="/trip/:tripId/map" element={<Layout><TripMapBuilder /></Layout>} />
      <Route path="/trip/:tripId/customise" element={<Layout><CustomiseTrip /></Layout>} />
      <Route path="/trip/:tripId/swap" element={<Layout><TripDetailSwapItem /></Layout>} />
    </Routes>
  );
}
