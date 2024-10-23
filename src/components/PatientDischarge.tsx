import React, { useState, useEffect } from 'react';
import { UserMinus, Search, Clock, Calendar, Activity, Filter } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { toast } from 'react-toastify';

interface Patient {
  mrn: string;
  patient_name: string;
  admission_date: string;
  admission_time: string;
  patient_status: string;
  specialty: string;
  discharge_date?: string;
  discharge_time?: string;
}

interface Consultation {
  mrn: string;
  patient_name: string;
  created_at: string;
  status: string;
  consultation_specialty: string;
  requesting_department: string;
  updated_at: string;
}

interface DischargeStats {
  specialty: string;
  dischargedToday: {
    admissions: number;
    consultations: number;
  };
  totalDischarged: {
    admissions: number;
    consultations: number;
  };
}

const specialtiesList = [
  'General Internal Medicine',
  'Respiratory Medicine',
  'Infectious Diseases',
  'Neurology',
  'Gastroenterology',
  'Rheumatology',
  'Hematology',
  'Thrombosis Medicine',
  'Immunology & Allergy',
  'Safety Admission',
  'Medical Consultations'
];

const PatientDischarge: React.FC = () => {
  const [records, setRecords] = useState<(Patient | Consultation)[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<Patient | Consultation | null>(null);
  const [dischargeDate, setDischargeDate] = useState('');
  const [dischargeTime, setDischargeTime] = useState('');
  const [dischargeNote, setDischargeNote] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [dischargeStats, setDischargeStats] = useState<DischargeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');

  useEffect(() => {
    fetchActiveRecords();
    fetchDischargeStats();
  }, [timeFilter]);

  const fetchActiveRecords = async () => {
    try {
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .eq('patient_status', 'Active')
        .order('admission_date', { ascending: false });

      const { data: consultationsData, error: consultationsError } = await supabase
        .from('consultations')
        .select('*')
        .eq('status', 'Active')
        .order('created_at', { ascending: false });

      if (patientsError) throw patientsError;
      if (consultationsError) throw consultationsError;

      setRecords([...(patientsData || []), ...(consultationsData || [])]);
    } catch (error) {
      console.error('Error fetching active records:', error);
      toast.error('Failed to fetch active records');
    } finally {
      setLoading(false);
    }
  };

  const getTimeFilterDates = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (timeFilter) {
      case 'today':
        return {
          start: today.toISOString(),
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        };
      case 'week':
        const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: weekStart.toISOString(), end: now.toISOString() };
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start: monthStart.toISOString(), end: now.toISOString() };
      case 'all':
        return { start: null, end: null };
      default:
        return { start: today.toISOString(), end: now.toISOString() };
    }
  };

  const fetchDischargeStats = async () => {
    try {
      const { start, end } = getTimeFilterDates();

      const statsPromises = specialtiesList.map(async (specialty) => {
        let query = supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('specialty', specialty)
          .eq('patient_status', 'Discharged');

        let consultQuery = supabase
          .from('consultations')
          .select('*', { count: 'exact', head: true })
          .eq('consultation_specialty', specialty)
          .eq('status', 'Completed');

        if (start && end) {
          query = query.gte('updated_at', start).lt('updated_at', end);
          consultQuery = consultQuery.gte('updated_at', start).lt('updated_at', end);
        }

        const [
          { count: dischargedPatientsCount, error: patientsError },
          { count: completedConsultationsCount, error: consultationsError },
          { count: totalDischargedPatients, error: totalPatientsError },
          { count: totalCompletedConsultations, error: totalConsultationsError }
        ] = await Promise.all([
          query,
          consultQuery,
          supabase
            .from('patients')
            .select('*', { count: 'exact', head: true })
            .eq('specialty', specialty)
            .eq('patient_status', 'Discharged'),
          supabase
            .from('consultations')
            .select('*', { count: 'exact', head: true })
            .eq('consultation_specialty', specialty)
            .eq('status', 'Completed')
        ]);

        if (patientsError) throw patientsError;
        if (consultationsError) throw consultationsError;
        if (totalPatientsError) throw totalPatientsError;
        if (totalConsultationsError) throw totalConsultationsError;

        return {
          specialty,
          dischargedToday: {
            admissions: dischargedPatientsCount || 0,
            consultations: completedConsultationsCount || 0
          },
          totalDischarged: {
            admissions: totalDischargedPatients || 0,
            consultations: totalCompletedConsultations || 0
          }
        };
      });

      const stats = await Promise.all(statsPromises);
      setDischargeStats(stats.filter(stat => 
        stat.dischargedToday.admissions > 0 || 
        stat.dischargedToday.consultations > 0 ||
        stat.totalDischarged.admissions > 0 ||
        stat.totalDischarged.consultations > 0
      ));
    } catch (error) {
      console.error('Error fetching discharge stats:', error);
      toast.error('Failed to fetch discharge statistics');
    }
  };

  const handleDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || !dischargeDate || !dischargeTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if ('specialty' in selectedRecord) {
        const { error } = await supabase
          .from('patients')
          .update({
            patient_status: 'Discharged',
            discharge_date: dischargeDate,
            discharge_time: dischargeTime,
            discharge_note: dischargeNote,
            updated_at: new Date().toISOString()
          })
          .eq('mrn', selectedRecord.mrn);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('consultations')
          .update({
            status: 'Completed',
            updated_at: new Date().toISOString()
          })
          .eq('mrn', selectedRecord.mrn);

        if (error) throw error;
      }

      toast.success('Record discharged successfully');
      setRecords(records.filter(record => record.mrn !== selectedRecord.mrn));
      setSelectedRecord(null);
      setDischargeDate('');
      setDischargeTime('');
      setDischargeNote('');
      fetchDischargeStats();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to discharge record');
    }
  };

  const filteredRecords = records.filter(record => {
    const matchesSearch = record.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         record.mrn.includes(searchTerm);
    const matchesSpecialty = !selectedSpecialty ||
                            ('specialty' in record ? record.specialty === selectedSpecialty :
                             record.consultation_specialty === selectedSpecialty);
    return matchesSearch && matchesSpecialty;
  });

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Discharge Management</h1>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Discharge Statistics</h2>
          <div className="flex space-x-2">
            <select
              className="block w-40 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
            >
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dischargeStats.map((stat) => (
            <div key={stat.specialty} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-4">
                <h3 className="text-lg font-medium text-gray-900">{stat.specialty}</h3>
                <div className="mt-2 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Period Discharges</p>
                    <div className="mt-1">
                      <p className="text-sm">
                        <span className="font-medium text-indigo-600">{stat.dischargedToday.admissions}</span>
                        <span className="text-gray-500 ml-1">Admissions</span>
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-indigo-600">{stat.dischargedToday.consultations}</span>
                        <span className="text-gray-500 ml-1">Consultations</span>
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Discharges</p>
                    <div className="mt-1">
                      <p className="text-sm">
                        <span className="font-medium text-indigo-600">{stat.totalDischarged.admissions}</span>
                        <span className="text-gray-500 ml-1">Admissions</span>
                      </p>
                      <p className="text-sm">
                        <span className="font-medium text-indigo-600">{stat.totalDischarged.consultations}</span>
                        <span className="text-gray-500 ml-1">Consultations</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">Active Records</h2>
            <div className="mt-2 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <div className="flex-1">
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                    placeholder="Search records..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex-1">
                <select
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                >
                  <option value="">All Specialties</option>
                  {specialtiesList.map((specialty) => (
                    <option key={specialty} value={specialty}>{specialty}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <ul className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {filteredRecords.map((record) => (
              <li
                key={record.mrn}
                className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer"
                onClick={() => setSelectedRecord(record)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-indigo-600 truncate">{record.patient_name}</p>
                  <div className="ml-2 flex-shrink-0 flex">
                    <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {'specialty' in record ? 'Admission' : 'Consultation'}
                    </p>
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-sm text-gray-500">
                      <Activity className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                      {'specialty' in record ? record.specialty : record.consultation_specialty}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                    <Calendar className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                    <p>
                      {'admission_date' in record ? record.admission_date : new Date(record.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {selectedRecord && (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Discharge Record: {selectedRecord.patient_name}
              </h3>
              <form onSubmit={handleDischarge} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="dischargeDate" className="block text-sm font-medium text-gray-700">
                    Discharge Date
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="date"
                      id="dischargeDate"
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                      value={dischargeDate}
                      onChange={(e) => setDischargeDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="dischargeTime" className="block text-sm font-medium text-gray-700">
                    Discharge Time
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Clock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="time"
                      id="dischargeTime"
                      className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                      value={dischargeTime}
                      onChange={(e) => setDischargeTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {'specialty' in selectedRecord && (
                  <div>
                    <label htmlFor="dischargeNote" className="block text-sm font-medium text-gray-700">
                      Discharge Note
                    </label>
                    <div className="mt-1">
                      <textarea
                        id="dischargeNote"
                        rows={3}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        value={dischargeNote}
                        onChange={(e) => setDischargeNote(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <UserMinus className="h-5 w-5 mr-2" />
                    Discharge Record
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDischarge;