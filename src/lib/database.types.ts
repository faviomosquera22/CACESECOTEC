export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ProfileRole = "student" | "teacher";
export type OptionLetter = "A" | "B" | "C" | "D";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          role: ProfileRole;
          career: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role: ProfileRole;
          career?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          role?: ProfileRole;
          career?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      questions: {
        Row: {
          id: string;
          question_text: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          correct_option: OptionLetter;
          explanation: string | null;
          category: string | null;
          difficulty: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          question_text: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          correct_option: OptionLetter;
          explanation?: string | null;
          category?: string | null;
          difficulty?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          question_text?: string;
          option_a?: string;
          option_b?: string;
          option_c?: string;
          option_d?: string;
          correct_option?: OptionLetter;
          explanation?: string | null;
          category?: string | null;
          difficulty?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      simulations: {
        Row: {
          id: string;
          student_id: string;
          started_at: string | null;
          finished_at: string | null;
          total_questions: number | null;
          correct_answers: number | null;
          incorrect_answers: number | null;
          score: number | null;
          time_used_seconds: number | null;
          status: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          started_at?: string | null;
          finished_at?: string | null;
          total_questions?: number | null;
          correct_answers?: number | null;
          incorrect_answers?: number | null;
          score?: number | null;
          time_used_seconds?: number | null;
          status?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          student_id?: string;
          started_at?: string | null;
          finished_at?: string | null;
          total_questions?: number | null;
          correct_answers?: number | null;
          incorrect_answers?: number | null;
          score?: number | null;
          time_used_seconds?: number | null;
          status?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      simulation_answers: {
        Row: {
          id: string;
          simulation_id: string;
          question_id: string;
          selected_option: OptionLetter | null;
          is_correct: boolean | null;
          answered_at: string | null;
        };
        Insert: {
          id?: string;
          simulation_id: string;
          question_id: string;
          selected_option?: OptionLetter | null;
          is_correct?: boolean | null;
          answered_at?: string | null;
        };
        Update: {
          id?: string;
          simulation_id?: string;
          question_id?: string;
          selected_option?: OptionLetter | null;
          is_correct?: boolean | null;
          answered_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      assign_student_career: {
        Args: {
          target_student_id: string;
          new_career: string;
        };
        Returns: {
          id: string;
          career: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type Profile = Tables<"profiles">;
export type Question = Tables<"questions">;
export type Simulation = Tables<"simulations">;
export type SimulationAnswer = Tables<"simulation_answers">;

export type SimulationAnswerWithQuestion = SimulationAnswer & {
  questions: Question | null;
};
