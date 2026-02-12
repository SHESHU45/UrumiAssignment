{{/*
Generate chart fullname
*/}}
{{- define "woocommerce.fullname" -}}
{{- printf "woo-%s" .Values.storeId | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "woocommerce.labels" -}}
app.kubernetes.io/name: woocommerce
app.kubernetes.io/instance: {{ include "woocommerce.fullname" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: store-platform
store-platform/store-id: "{{ .Values.storeId }}"
store-platform/store-name: "{{ .Values.storeName }}"
{{- end }}

{{/*
WordPress labels
*/}}
{{- define "woocommerce.wordpress.labels" -}}
{{ include "woocommerce.labels" . }}
app.kubernetes.io/component: wordpress
{{- end }}

{{/*
MySQL labels
*/}}
{{- define "woocommerce.mysql.labels" -}}
{{ include "woocommerce.labels" . }}
app.kubernetes.io/component: mysql
{{- end }}

{{/*
Selector labels for WordPress
*/}}
{{- define "woocommerce.wordpress.selectorLabels" -}}
app.kubernetes.io/name: woocommerce
app.kubernetes.io/instance: {{ include "woocommerce.fullname" . }}
app.kubernetes.io/component: wordpress
{{- end }}

{{/*
Selector labels for MySQL
*/}}
{{- define "woocommerce.mysql.selectorLabels" -}}
app.kubernetes.io/name: woocommerce
app.kubernetes.io/instance: {{ include "woocommerce.fullname" . }}
app.kubernetes.io/component: mysql
{{- end }}
