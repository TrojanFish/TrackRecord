import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Footprints, Bike, AlertTriangle, CheckCircle, Wrench, Calendar, Ruler, Clock, Zap, Flame, Shield, Grid } from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  CartesianGrid, Cell 
} from 'recharts';

const Gear = ({ stats }) => {
  const [activeTab, setActiveTab] = useState('Equipment'); // Equipment, Maintenance, Recording
  const [selectedGearIndex, setSelectedGearIndex] = useState(0);

  if (!stats || !stats.gear_stats) return null;

  const IconMap = {
    'Footprints': Footprints,
    'Bike': Bike,
    'Layers': Layers
  };

  const recordingDevices = stats.recording_stats || [];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="page-content"
    >
      {/* Platform Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem' }}>
        {['Equipment', 'Maintenance', 'Recording Devices'].map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`platform-card ${activeTab === tab ? 'active' : ''}`}
            style={{ 
              padding: '1rem 2rem', 
              cursor: 'pointer',
              color: 'white',
              fontWeight: 800,
              fontSize: '0.8rem',
              letterSpacing: '1px',
              border: activeTab === tab ? '1px solid var(--accent-cyan)' : '1px solid transparent',
              background: activeTab === tab ? 'rgba(6, 182, 212, 0.2)' : 'var(--bg-card)'
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'Equipment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Gear Stats Table-like View */}
          <div className="platform-card" style={{ padding: '2rem' }}>
             <h3 style={{ fontSize: '1.2rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 800 }}>
                <Shield size={22} color="var(--accent-cyan)" /> EQUIPMENT STATISTICS
             </h3>
             <table className="activities-table">
               <thead>
                 <tr>
                   <th># GEAR</th>
                   <th><Ruler size={14} /> DISTANCE</th>
                   <th><Zap size={14} /> ELEVATION</th>
                   <th><Clock size={14} /> TIME</th>
                   <th><Flame size={14} /> CALORIES</th>
                   <th>STATUS</th>
                 </tr>
               </thead>
                <tbody>
                  {stats.gear_stats.map((gear, idx) => {
                    const Icon = IconMap[gear.icon] || Grid;
                    return (
                      <tr key={gear.name} 
                          onClick={() => setSelectedGearIndex(idx)} 
                          style={{ cursor: 'pointer', background: selectedGearIndex === idx ? 'rgba(6, 182, 212, 0.05)' : 'transparent' }}>
                        <td style={{ fontWeight: 700, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Icon size={16} /> {gear.name}
                        </td>
                        <td>{gear.distance} km</td>
                        <td>{gear.elevation || Math.round(gear.distance * (gear.type === 'Run' ? 8 : 15))} m</td>
                        <td>{gear.time || `${gear.count} sessions`}</td>
                        <td>{Math.round(gear.distance * (gear.type === 'Run' ? 62 : 28))} kcal</td>
                        <td>
                           <span style={{ 
                             padding: '4px 12px', 
                             borderRadius: '12px', 
                             fontSize: '0.7rem', 
                             fontWeight: 800,
                             background: (gear.distance / gear.limit) > 0.9 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                             color: (gear.distance / gear.limit) > 0.9 ? '#ef4444' : '#10b981'
                           }}>
                             {(gear.distance / gear.limit) > 0.9 ? 'REPLACE' : 'READY'}
                           </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
           </div>
 
           {/* Monthly Distance Chart per Gear */}
           <div className="platform-card" style={{ padding: '2rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>MONTHLY PERFORMANCE: {stats.gear_stats[selectedGearIndex]?.name}</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                   {stats.gear_stats.map((g, i) => (
                     <button 
                       key={i}
                       onClick={() => setSelectedGearIndex(i)}
                       style={{ 
                         padding: '4px 12px', 
                         borderRadius: '8px', 
                         fontSize: '0.7rem', 
                         background: selectedGearIndex === i ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)',
                         color: selectedGearIndex === i ? 'black' : 'white',
                         border: 'none',
                         cursor: 'pointer',
                         fontWeight: 700
                       }}
                     >
                       GEAR {i+1}
                     </button>
                   ))}
                </div>
             </div>
             <div style={{ height: '300px', width: '100%' }}>
               <ResponsiveContainer>
                 <BarChart data={stats.gear_stats[selectedGearIndex]?.monthly_mileage || []}>
                   <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                   <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={11} />
                   <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
                   <Tooltip 
                     contentStyle={{ background: '#0a1628', border: 'none', borderRadius: '8px' }}
                   />
                   <Bar dataKey="dist" radius={[4, 4, 0, 0]}>
                     {
                       (stats.gear_stats[selectedGearIndex]?.monthly_mileage || []).map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={index === (stats.gear_stats[selectedGearIndex].monthly_mileage.length - 1) ? 'var(--accent-cyan)' : 'var(--accent-blue)'} />
                       ))
                     }
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </div>
        </div>
      )}

      {activeTab === 'Maintenance' && (
        <div className="platform-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
          {stats.gear_stats?.map(gear => {
            const totalPercent = Math.min(100, (gear.distance / gear.limit) * 100);
            const Icon = IconMap[gear.icon] || Grid;
            return (
              <div key={gear.name} className="platform-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                   <div style={{ display: 'flex', gap: '20px' }}>
                      <div style={{ padding: '16px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '16px', color: 'var(--accent-cyan)' }}>
                          <Icon size={32} />
                      </div>
                      <div>
                          <h4 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900 }}>{gear.name}</h4>
                          <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{gear.count} ACTIVITIES</span>
                      </div>
                   </div>
                </div>

                <div>
                   <div style={{ height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', overflow: 'hidden' }}>
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${totalPercent}%` }}
                        style={{ height: '100%', background: totalPercent > 90 ? '#ef4444' : 'var(--accent-cyan)' }}
                      />
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', opacity: 0.4 }}>
                      <span>Progress: {Math.round(totalPercent)}%</span>
                      <span>Limit: {gear.limit} km</span>
                   </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '16px' }}>
                   <h5 style={{ fontSize: '0.8rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.7 }}>
                      <Wrench size={16} /> COMPONENT HEALTH
                   </h5>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {gear.components?.map(comp => (
                        <div key={comp.name}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                              <span>{comp.name}</span>
                              <span style={{ opacity: 0.6 }}>{comp.distance} / {comp.limit} km</span>
                           </div>
                           <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(100, (comp.distance/comp.limit)*100)}%`, background: '#3b82f6' }} />
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'Recording Devices' && (
        <div className="platform-card" style={{ padding: '2rem' }}>
           <h3 style={{ fontSize: '1.2rem', marginBottom: '2rem', fontWeight: 800 }}>RECORDING DEVICES</h3>
           <table className="activities-table">
             <thead>
               <tr>
                 <th>DEVICE</th>
                 <th>ACTIVITIES</th>
                 <th>DISTANCE</th>
                 <th>ELEVATION</th>
                 <th>TOTAL TIME</th>
               </tr>
             </thead>
             <tbody>
               {recordingDevices.map(device => (
                 <tr key={device.name}>
                   <td style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{device.name}</td>
                   <td>{device.count}</td>
                   <td>{device.distance} km</td>
                   <td>{device.elevation} m</td>
                   <td>{device.time}</td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      )}
    </motion.div>
  );
};

export default Gear;
