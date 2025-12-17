import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react";
import { 
  DEPARTMENT_EVALUATION_QUESTIONS, 
  DEPARTMENT_DISPLAY_NAMES, 
  type DepartmentType,
  type DepartmentQuestion,
  type EvaluationAnswer,
  type DepartmentEvaluation,
  type RiskLevel
} from "@/lib/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { evaluationApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface DepartmentEvaluationFormProps {
  requestId: string;
  userDepartment: DepartmentType;
  userRole: 'MANAGER' | 'HOD';
  requestDepartment: DepartmentType;
  existingManagerEvaluation?: DepartmentEvaluation;
  onComplete?: () => void;
}

interface AnswerState {
  answer: 'YES' | 'NO' | null;
  riskLevel: RiskLevel | null;
  remarks: string;
}

export function DepartmentEvaluationForm({
  requestId,
  userDepartment,
  userRole,
  requestDepartment,
  existingManagerEvaluation,
  onComplete,
}: DepartmentEvaluationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const questions = DEPARTMENT_EVALUATION_QUESTIONS[userDepartment] || [];
  
  const [answers, setAnswers] = useState<Record<string, AnswerState>>(() => {
    const initial: Record<string, AnswerState> = {};
    questions.forEach(q => {
      initial[q.key] = { answer: null, riskLevel: null, remarks: '' };
    });
    return initial;
  });
  
  const [overallRemarks, setOverallRemarks] = useState("");

  const evaluationMutation = useMutation({
    mutationFn: (data: { 
      answers: EvaluationAnswer[]; 
      decision: 'APPROVED' | 'REJECTED'; 
      remarks?: string 
    }) => evaluationApi.submitEvaluation(requestId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      const action = variables.decision === 'APPROVED' ? 'approved' : 'rejected';
      toast({ 
        title: "Evaluation & Decision Submitted", 
        description: `Your evaluation has been recorded and the request has been ${action}.` 
      });
      onComplete?.();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateAnswer = (questionKey: string, field: keyof AnswerState, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionKey]: { ...prev[questionKey], [field]: value }
    }));
  };

  const isQuestionComplete = (questionKey: string): boolean => {
    const answer = answers[questionKey];
    if (!answer.answer || !answer.riskLevel) return false;
    if ((answer.answer === 'NO' || answer.riskLevel === 'HIGH') && !answer.remarks.trim()) {
      return false;
    }
    return true;
  };

  const allQuestionsComplete = questions.every(q => isQuestionComplete(q.key));

  const getValidationMessage = (questionKey: string): string | null => {
    const answer = answers[questionKey];
    if (!answer.answer) return "Please select Yes or No";
    if (!answer.riskLevel) return "Please select a risk level";
    if ((answer.answer === 'NO' || answer.riskLevel === 'HIGH') && !answer.remarks.trim()) {
      return "Remarks are required when answer is 'No' or risk is 'High'";
    }
    return null;
  };

  const handleSubmit = (decision: 'APPROVED' | 'REJECTED') => {
    if (!allQuestionsComplete) {
      toast({ 
        title: "Incomplete Evaluation", 
        description: "Please complete all questions before submitting.", 
        variant: "destructive" 
      });
      return;
    }

    if (decision === 'REJECTED' && !overallRemarks.trim()) {
      toast({ 
        title: "Remarks Required", 
        description: "Please provide remarks for rejection.", 
        variant: "destructive" 
      });
      return;
    }

    const formattedAnswers: EvaluationAnswer[] = questions.map(q => ({
      questionKey: q.key,
      answer: answers[q.key].answer!,
      riskLevel: answers[q.key].riskLevel!,
      remarks: answers[q.key].remarks,
    }));

    evaluationMutation.mutate({
      answers: formattedAnswers,
      decision,
      remarks: overallRemarks || undefined,
    });
  };

  const getRiskBadgeColor = (level: RiskLevel | null) => {
    switch (level) {
      case 'LOW': return 'bg-green-100 text-green-800 border-green-300';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'HIGH': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  if (questions.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          No evaluation questions defined for your department ({DEPARTMENT_DISPLAY_NAMES[userDepartment]}).
        </AlertDescription>
      </Alert>
    );
  }

  const borderColor = userRole === 'MANAGER' ? 'border-indigo-200' : 'border-purple-200';
  const headerBg = userRole === 'MANAGER' ? 'bg-indigo-50' : 'bg-purple-50';

  return (
    <Card className={`border-2 ${borderColor} shadow-lg`}>
      <CardHeader className={headerBg}>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Department Evaluation - {DEPARTMENT_DISPLAY_NAMES[userDepartment]}
        </CardTitle>
        <CardDescription>
          As the {userRole === 'MANAGER' ? 'Manager' : 'HOD'} of {DEPARTMENT_DISPLAY_NAMES[userDepartment]}, 
          complete this evaluation for the request from {DEPARTMENT_DISPLAY_NAMES[requestDepartment]}.
          <br />
          <span className="text-sm font-medium text-orange-600 mt-1 block">
            All questions must be answered before you can approve or reject.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {existingManagerEvaluation && userRole === 'HOD' && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <span className="font-medium">Manager Evaluation Available:</span> The Manager of your department 
              has already submitted their evaluation. You can review their answers below while completing your own.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {questions.map((question, index) => {
            const existingAnswer = existingManagerEvaluation?.evaluationAnswers.find(
              a => a.questionKey === question.key
            );
            const validationMsg = getValidationMessage(question.key);
            const isComplete = isQuestionComplete(question.key);

            return (
              <div key={question.key} className="border rounded-lg p-4 bg-gray-50/50">
                <div className="flex items-start gap-3 mb-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{question.text}</p>
                    {question.required && (
                      <Badge variant="outline" className="mt-1 text-xs">Required</Badge>
                    )}
                  </div>
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                  )}
                </div>

                {existingAnswer && userRole === 'HOD' && (
                  <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-xs font-medium text-blue-700 mb-1">Manager's Response:</p>
                    <div className="flex items-center gap-3 text-sm">
                      <span>Answer: <strong>{existingAnswer.answer}</strong></span>
                      <Badge className={getRiskBadgeColor(existingAnswer.riskLevel)}>
                        {existingAnswer.riskLevel} Risk
                      </Badge>
                      {existingAnswer.remarks && (
                        <span className="text-gray-600 italic">"{existingAnswer.remarks}"</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm mb-2 block">Answer</Label>
                    <RadioGroup
                      value={answers[question.key].answer || ''}
                      onValueChange={(value) => updateAnswer(question.key, 'answer', value)}
                      className="flex gap-4"
                      data-testid={`answer-${question.key}`}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="YES" id={`${question.key}-yes`} />
                        <Label htmlFor={`${question.key}-yes`} className="cursor-pointer">Yes</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="NO" id={`${question.key}-no`} />
                        <Label htmlFor={`${question.key}-no`} className="cursor-pointer">No</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm mb-2 block">Risk Level</Label>
                    <RadioGroup
                      value={answers[question.key].riskLevel || ''}
                      onValueChange={(value) => updateAnswer(question.key, 'riskLevel', value)}
                      className="flex gap-2"
                      data-testid={`risk-${question.key}`}
                    >
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="LOW" id={`${question.key}-low`} />
                        <Label htmlFor={`${question.key}-low`} className="cursor-pointer text-green-700 text-xs">Low</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="MEDIUM" id={`${question.key}-med`} />
                        <Label htmlFor={`${question.key}-med`} className="cursor-pointer text-yellow-700 text-xs">Med</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <RadioGroupItem value="HIGH" id={`${question.key}-high`} />
                        <Label htmlFor={`${question.key}-high`} className="cursor-pointer text-red-700 text-xs">High</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm mb-2 block">
                      Remarks
                      {(answers[question.key].answer === 'NO' || answers[question.key].riskLevel === 'HIGH') && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </Label>
                    <Textarea
                      placeholder="Add remarks..."
                      value={answers[question.key].remarks}
                      onChange={(e) => updateAnswer(question.key, 'remarks', e.target.value)}
                      className="h-16 text-sm"
                      data-testid={`remarks-${question.key}`}
                    />
                  </div>
                </div>

                {validationMsg && !isComplete && (
                  <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {validationMsg}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <Label>Overall Remarks (required for rejection)</Label>
            <Textarea
              placeholder="Enter any additional remarks..."
              value={overallRemarks}
              onChange={(e) => setOverallRemarks(e.target.value)}
              className="mt-2"
              data-testid="input-overall-remarks"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              Progress: {questions.filter(q => isQuestionComplete(q.key)).length} / {questions.length} questions completed
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={() => handleSubmit('APPROVED')}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              disabled={!allQuestionsComplete || evaluationMutation.isPending}
              data-testid="btn-eval-approve"
            >
              {evaluationMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Submit & Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleSubmit('REJECTED')}
              className="flex-1"
              disabled={!allQuestionsComplete || evaluationMutation.isPending}
              data-testid="btn-eval-reject"
            >
              {evaluationMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              Submit & Reject
            </Button>
          </div>

          {!allQuestionsComplete && (
            <Alert variant="default" className="bg-orange-50 border-orange-200">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                Complete all evaluation questions to enable the approval/rejection buttons.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
