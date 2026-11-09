export type Role = 'company-admin' | 'supervisor' | 'camp-manager' | 'service-provider' | 'viewer';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'draft' | 'open' | 'in-progress' | 'escalated' | 'resolved' | 'closed';
export interface Company {
  id: string;
  name: string;
  country_code: string;
  email: string;
  phone: string;
  address: string;
  status: 'active' | 'inactive';
}
export interface Profile {
  id: string;
  full_name: string;
  email: string;
}
export interface Membership {
  id: string;
  company_id: string;
  user_id: string;
  role: Role;
  status: 'pending' | 'active' | 'rejected';
  profiles?: Profile;
}
export interface Camp {
  id: string;
  company_id: string;
  name: string;
  camp_number: string;
  location: string;
  capacity: number;
  status: string;
}
export interface Provider {
  id: string;
  company_id: string;
  name: string;
  category: string;
  phone: string;
  email: string;
  status: string;
}
export interface IssueType {
  id: string;
  company_id: string;
  name: string;
  description: string;
  severity_default: Severity;
  is_active: boolean;
}
export interface Incident {
  id: string;
  company_id: string;
  report_no: string;
  title: string;
  camp_id: string | null;
  issue_type_id: string;
  assigned_to: string | null;
  provider_id: string | null;
  severity: Severity;
  status: IncidentStatus;
  location: string;
  description: string;
  action_taken: string;
  reported_by: string;
  reported_at: string;
  updated_at: string;
}
export interface Sitrep {
  id: string;
  company_id: string;
  service_report_id: string;
  sitrep_no: string;
  summary: string;
  impact: string;
  current_situation: string;
  immediate_actions: string;
  resources_required: string;
  recommendations: string;
  status: 'draft' | 'submitted' | 'approved';
  reported_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface Comment {
  id: string;
  company_id: string;
  report_id: string;
  author_id: string;
  body: string;
  created_at: string;
}
export interface Attachment {
  id: string;
  company_id: string;
  report_id: string;
  uploaded_by: string;
  filename: string;
  path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}
export interface Activity {
  id: string;
  company_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}
export interface Notification {
  id: string;
  title: string;
  report_id: string | null;
  read_at: string | null;
  created_at: string;
}
export interface PlatformAccess {
  id: string;
  user_id: string;
  role: 'super-admin' | 'country-admin';
  country_code: string | null;
}
export interface Movement {
  id: string;
  company_id: string;
  group_name: string;
  origin: string;
  destination: string;
  scheduled_at: string;
  pilgrim_count: number;
  arrived_count: number;
  transport: string;
  leader: string;
  contact_phone: string;
  status: string;
  notes: string;
}
export interface Vacating {
  id: string;
  company_id: string;
  camp_id: string;
  departure_at: string;
  pilgrims_expected: number;
  pilgrims_verified: number;
  baggage_expected: number;
  baggage_verified: number;
  transport_confirmed: boolean;
  final_sweep_done: boolean;
  status: string;
  notes: string;
}
export interface WorkspaceData {
  camps: Camp[];
  providers: Provider[];
  issueTypes: IssueType[];
  incidents: Incident[];
  sitreps: Sitrep[];
  members: Membership[];
  notifications: Notification[];
  activities: Activity[];
  movements: Movement[];
  vacatings: Vacating[];
}
