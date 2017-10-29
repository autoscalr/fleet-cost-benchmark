#!/usr/bin/env bash
export PATH=$PATH:/usr/local/go/bin
# load and build the AutoScalr Terraform plugin
go get github.com/autoscalr/terraform-provider-autoscalr
cd ~/go/src/github.com/autoscalr/terraform-provider-autoscalr/
./build.sh
cd
mkdir -p ~/terraform/terraform.d/plugins/linux_amd64
cp ~/go/src/github.com/autoscalr/terraform-provider-autoscalr/terraform-provider-autoscalr ~/terraform/terraform.d/plugins/linux_amd64
# load aws-cost-analysis tools
git clone https://github.com/concurrencylabs/aws-cost-analysis.git
sudo pip install -r aws-cost-analysis/requirements.txt